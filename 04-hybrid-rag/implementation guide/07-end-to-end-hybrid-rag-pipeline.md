# 🔄 Chapter 7 — End-to-End Hybrid RAG Pipeline

Welcome to Chapter 7 of the **Hybrid RAG Implementation Guide**. In this chapter, we explore the complete **Hybrid RAG Pipeline Facade** orchestrating dual indexing, parallel retrieval, candidate fusion, and answer synthesis.

All code snippets in this chapter are taken directly from [`04-hybrid-rag/code`](../code).

---

## 1. Complete Pipeline Code (`src/pipeline/hybrid-pipeline.ts`)

File: [`04-hybrid-rag/code/src/pipeline/hybrid-pipeline.ts`](../code/src/pipeline/hybrid-pipeline.ts)

```typescript
import {
  Document,
  Chunk,
  HybridConfig,
  HybridRetrievalResult,
  RAGResponse,
  FusionStrategy
} from '../schemas';
import { VectorStore } from '../dense/vector-store';
import { InvertedIndex } from '../sparse/inverted-index';
import { BM25Engine } from '../sparse/bm25';
import { ReciprocalRankFusion } from '../fusion/rrf';
import { WeightedScoreFusion, WeightedRRF } from '../fusion/weighted-fusion';
import { EmbeddingModel } from '../embeddings/interface';
import { MockEmbeddingModel } from '../embeddings/mock-embeddings';
import { OpenAIEmbeddingModel } from '../embeddings/openai-embeddings';
import { LLMProvider } from '../llm/interface';
import { MockLLMProvider } from '../llm/mock-llm';
import { OpenAILLMProvider } from '../llm/openai-llm';
import { RecursiveTextSplitter } from '../splitters/text-splitter';

export interface HybridPipelineInitOptions {
  embeddingModel?: EmbeddingModel;
  llmProvider?: LLMProvider;
  useOpenAI?: boolean;
}

export class HybridRAGPipeline {
  private vectorStore: VectorStore;
  private invertedIndex: InvertedIndex;
  private bm25Engine: BM25Engine;
  private textSplitter: RecursiveTextSplitter;
  private llmProvider: LLMProvider;
  private totalChunksIndexedCount: number = 0;

  constructor(options?: HybridPipelineInitOptions) {
    let embedder: EmbeddingModel;
    let llm: LLMProvider;

    if (options?.embeddingModel) {
      embedder = options.embeddingModel;
    } else if (options?.useOpenAI && process.env.OPENAI_API_KEY) {
      embedder = new OpenAIEmbeddingModel();
    } else {
      embedder = new MockEmbeddingModel();
    }

    if (options?.llmProvider) {
      llm = options.llmProvider;
    } else if (options?.useOpenAI && process.env.OPENAI_API_KEY) {
      llm = new OpenAILLMProvider();
    } else {
      llm = new MockLLMProvider();
    }

    this.vectorStore = new VectorStore(embedder);
    this.invertedIndex = new InvertedIndex();
    this.bm25Engine = new BM25Engine(this.invertedIndex);
    this.textSplitter = new RecursiveTextSplitter();
    this.llmProvider = llm;
  }

  async indexDocuments(documents: Document[]): Promise<number> {
    const chunks = this.textSplitter.splitDocuments(documents);
    await this.indexChunks(chunks);
    return chunks.length;
  }

  async indexChunks(chunks: Chunk[]): Promise<void> {
    if (chunks.length === 0) return;

    // Index into Dense Vector Store and Sparse Inverted Index
    await this.vectorStore.addChunks(chunks);
    this.invertedIndex.addChunks(chunks);
    this.totalChunksIndexedCount += chunks.length;
  }

  async search(query: string, config?: HybridConfig): Promise<HybridRetrievalResult[]> {
    const topK = config?.topK ?? 5;
    const denseTopK = config?.denseTopK ?? 20;
    const sparseTopK = config?.sparseTopK ?? 20;
    const fusionStrategy: FusionStrategy = config?.fusionStrategy ?? 'rrf';
    const rrfK = config?.rrfK ?? 60;
    const alpha = config?.alpha ?? 0.5;
    const normalizerType = config?.normalizerType ?? 'minmax';

    // Execute Dense vector search and Sparse BM25 search concurrently
    const [denseResults, sparseResults] = await Promise.all([
      this.vectorStore.search(query, denseTopK),
      Promise.resolve(this.bm25Engine.search(query, sparseTopK))
    ]);

    // Apply selected rank/score fusion strategy
    let mergedResults: HybridRetrievalResult[];

    switch (fusionStrategy) {
      case 'weighted_score': {
        const fusionEngine = new WeightedScoreFusion({ alpha, normalizerType });
        mergedResults = fusionEngine.fuse(denseResults, sparseResults, topK);
        break;
      }
      case 'weighted_rrf': {
        const fusionEngine = new WeightedRRF({ alpha, rrfK });
        mergedResults = fusionEngine.fuse(denseResults, sparseResults, topK);
        break;
      }
      case 'rrf':
      default: {
        const fusionEngine = new ReciprocalRankFusion({ k: rrfK });
        mergedResults = fusionEngine.fuse(denseResults, sparseResults, topK);
        break;
      }
    }

    return mergedResults;
  }

  async answer(query: string, config?: HybridConfig): Promise<RAGResponse> {
    const startTime = Date.now();
    const fusionStrategy: FusionStrategy = config?.fusionStrategy ?? 'rrf';
    const rrfK = config?.rrfK ?? 60;
    const alpha = config?.alpha ?? 0.5;

    // 1. Hybrid Retrieval Phase
    const retStart = Date.now();
    const hybridCandidates = await this.search(query, config);
    const retLatency = Date.now() - retStart;

    // Extract raw chunk text contents for prompt augmentation
    const contextTexts = hybridCandidates.map((c) => c.chunk.content);

    // 2. Generation Phase
    const genStart = Date.now();
    const answerText = await this.llmProvider.generateAnswer(query, contextTexts);
    const genLatency = Date.now() - genStart;

    const totalLatency = Date.now() - startTime;

    return {
      question: query,
      answer: answerText,
      contextChunks: hybridCandidates,
      metadata: {
        model: this.llmProvider.getModelName(),
        fusionStrategy,
        rrfK,
        alpha,
        denseCandidateCount: hybridCandidates.filter((c) => c.denseResult).length,
        sparseCandidateCount: hybridCandidates.filter((c) => c.sparseResult).length,
        totalChunksIndexed: this.totalChunksIndexedCount,
        retrievalLatencyMs: retLatency,
        generationLatencyMs: genLatency,
        totalLatencyMs: totalLatency
      }
    };
  }

  getDenseStore(): VectorStore {
    return this.vectorStore;
  }

  getSparseEngine(): BM25Engine {
    return this.bm25Engine;
  }

  clear(): void {
    this.vectorStore.clear();
    this.invertedIndex.clear();
    this.totalChunksIndexedCount = 0;
  }

  size(): number {
    return this.totalChunksIndexedCount;
  }
}
```

### Detailed Method Breakdown (`HybridRAGPipeline`)

- `indexDocuments(documents)`: Uses `RecursiveTextSplitter` to partition documents into chunks, then invokes `indexChunks`.
- `indexChunks(chunks)`: Concurrently inserts chunks into the `VectorStore` (dense embedding generation and indexing) and `InvertedIndex` (sparse tokenization and posting generation).
- `search(query, config)`: Uses `Promise.all` to query `VectorStore` and `BM25Engine` in parallel. Passes resulting candidates to the selected fusion strategy (`ReciprocalRankFusion`, `WeightedScoreFusion`, or `WeightedRRF`). Returns Top-K hybrid candidates.
- `answer(query, config)`: Executes hybrid search, constructs augmented prompt context, passes prompt to `LLMProvider`, tracks retrieval and generation latencies, and returns complete `RAGResponse`.

In [Chapter 8](./08-comparative-benchmarking-and-rank-correlation.md), we will build the **Comparative Benchmarking & Rank Correlation** module.
