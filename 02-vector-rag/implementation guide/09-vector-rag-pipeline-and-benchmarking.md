# Chapter 9 — Vector RAG Pipeline Orchestration & ANN Benchmarking

This chapter covers the central facade class `VectorRAGPipeline` and the `VectorBenchmarkRunner` performance evaluation framework.

Source code locations:
- [`src/pipeline/vectorRag.ts`](../code/src/pipeline/vectorRag.ts)
- [`src/pipeline/benchmark.ts`](../code/src/pipeline/benchmark.ts)

---

## 1. VectorRAGPipeline Facade

The `VectorRAGPipeline` class encapsulates document loading, text splitting, embedding generation, vector database search, and LLM answer generation:

```typescript
import { FileDocumentLoader } from '../loaders/text';
import { RecursiveCharacterTextSplitter } from '../splitters/character';
import { VectorStore } from '../vectordb/vectorStore';
import { EmbeddingModel } from '../embeddings/base';
import { LLMProvider } from '../llm/base';
import { Document, IndexConfig, IndexType, MetadataFilter, RAGResponse, RetrievalResult, SimilarityMetric, VectorRecord } from '../schemas';

export class VectorRAGPipeline {
  private splitter: RecursiveCharacterTextSplitter;
  private embedder: EmbeddingModel;
  private vectorStore: VectorStore;
  private llm: LLMProvider;

  constructor(options: {
    chunkSize?: number;
    chunkOverlap?: number;
    topK?: number;
    indexType?: IndexType;
    indexConfig?: IndexConfig;
    embeddingProvider?: 'mock' | 'openai' | 'gemini' | EmbeddingModel;
    llmProvider?: 'mock' | 'openai' | 'gemini' | LLMProvider;
  } = {}) {
    // ... Provider & VectorStore initialization ...
  }

  public async ingestPath(pathOrDir: string): Promise<{ numDocuments: number; numChunks: number }> {
    const loader = new FileDocumentLoader(pathOrDir);
    const docs = await loader.load();
    return this.ingest(docs);
  }

  public async query(question: string, topK?: number, filter?: MetadataFilter): Promise<RAGResponse> {
    const startTime = Date.now();

    // 1. Vector Retrieval
    const retrievalStart = Date.now();
    const queryVector = await this.embedder.embedQuery(question);
    const retrieved = await this.vectorStore.search(queryVector, topK ?? 3, 'cosine', filter);
    const retrievalLatencyMs = Date.now() - retrievalStart;

    // 2. LLM Synthesis
    const generationStart = Date.now();
    const llmResp = await this.llm.generateAnswer(question, retrieved.map((r) => r.chunk));
    const generationLatencyMs = Date.now() - generationStart;

    return {
      question,
      answer: llmResp.content,
      contextChunks: retrieved,
      metadata: {
        model: llmResp.model,
        indexType: this.vectorStore.getIndexType() as IndexType,
        similarityMetric: 'cosine',
        retrievalLatencyMs,
        generationLatencyMs,
        totalLatencyMs: Date.now() - startTime,
      },
    };
  }
}
```

---

## 2. ANN Performance & Recall Benchmarking Engine

The `VectorBenchmarkRunner` compares `Flat`, `HNSW`, and `IVF` index strategies across synthetic datasets:

```typescript
import { VectorStore } from '../vectordb/vectorStore';
import { MockEmbeddingModel } from '../embeddings/mock';
import { BenchmarkResult, IndexType } from '../schemas';

export class VectorBenchmarkRunner {
  public static async runBenchmark(datasetSize: number = 100, topK: number = 5): Promise<BenchmarkResult[]> {
    const embedder = new MockEmbeddingModel(128);
    // ... Synthesize dataset & queries ...

    // 1. Ground Truth from Flat Index (Recall = 100%)
    const flatStore = new VectorStore({ indexConfig: { type: 'flat' } });
    await flatStore.addBatch(records);

    // 2. Evaluate HNSW and IVF relative to Flat ground truth
    // Recall@K = (Matching Returned Record IDs) / Ground Truth Record IDs
  }
}
```

### Sample Benchmark Table Output

```text
┌─────────┬────────────┬───────────────┬───────────┬────────────────────┬────────────────────┬──────────────┬───────────┐
│ (index) │ Index Type │ Total Records │ Dimension │ Indexing Time (ms) │ Query Latency (ms) │ Recall@K (%) │ Avg Score │
├─────────┼────────────┼───────────────┼───────────┼────────────────────┼────────────────────┼──────────────┼───────────┤
│ 0       │ 'FLAT'     │ 100           │ 128       │ 0                  │ '0.200'            │ '100.0%'     │ '0.8053'  │
│ 1       │ 'HNSW'     │ 100           │ 128       │ 44                 │ '0.400'            │ '20.0%'      │ '0.7911'  │
│ 2       │ 'IVF'      │ 100           │ 128       │ 3                  │ '0.200'            │ '100.0%'     │ '0.8053'  │
└─────────┴────────────┴───────────────┴───────────┴────────────────────┴────────────────────┴──────────────┴───────────┘
```
