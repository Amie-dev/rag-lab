# Chapter 7 — RAG Pipeline Orchestration

The pipeline module combines document ingestion, vector retrieval, context augmentation, and LLM generation into a single unified facade class: `BasicRAGPipeline`.

We implement four components:
1. `src/pipeline/ingestion.ts` — Ingestion Pipeline.
2. `src/pipeline/retrieval.ts` — Retrieval Engine.
3. `src/pipeline/generation.ts` — Generation Engine.
4. `src/pipeline/basicRag.ts` — `BasicRAGPipeline` Facade.

---

## 1. Ingestion Pipeline (`src/pipeline/ingestion.ts`)

```typescript
import { DocumentLoader } from '../loaders/base';
import { TextSplitter } from '../splitters/base';
import { EmbeddingModel } from '../embeddings/base';
import { VectorStore } from '../vectordb/base';
import { Document, Chunk, VectorRecord } from '../schemas';

export class IngestionPipeline {
  private loader: DocumentLoader;
  private splitter: TextSplitter;
  private embeddingModel: EmbeddingModel;
  private vectorStore: VectorStore;

  constructor(
    loader: DocumentLoader,
    splitter: TextSplitter,
    embeddingModel: EmbeddingModel,
    vectorStore: VectorStore
  ) {
    this.loader = loader;
    this.splitter = splitter;
    this.embeddingModel = embeddingModel;
    this.vectorStore = vectorStore;
  }

  async ingest(filePathOrContent: string): Promise<{ documents: Document[]; chunks: Chunk[]; count: number }> {
    const documents = await this.loader.load(filePathOrContent);
    if (documents.length === 0) return { documents: [], chunks: [], count: 0 };

    const chunks = this.splitter.splitDocuments(documents);
    if (chunks.length === 0) return { documents, chunks: [], count: 0 };

    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await this.embeddingModel.embedDocuments(chunkTexts);

    const records: VectorRecord[] = chunks.map((chunk, idx) => ({
      id: chunk.id,
      vector: embeddings[idx],
      chunk,
      metadata: chunk.metadata,
    }));

    await this.vectorStore.add(records);

    return { documents, chunks, count: records.length };
  }
}
```

---

## 2. Retrieval Engine (`src/pipeline/retrieval.ts`)

```typescript
import { EmbeddingModel } from '../embeddings/base';
import { VectorStore } from '../vectordb/base';
import { Chunk, RetrievalResult, SimilarityMetric } from '../schemas';

export class RetrievalEngine {
  private embeddingModel: EmbeddingModel;
  private vectorStore: VectorStore;
  private defaultMetric: SimilarityMetric;

  constructor(embeddingModel: EmbeddingModel, vectorStore: VectorStore, defaultMetric: SimilarityMetric = 'cosine') {
    this.embeddingModel = embeddingModel;
    this.vectorStore = vectorStore;
    this.defaultMetric = defaultMetric;
  }

  async retrieve(
    question: string,
    topK: number = 3,
    metric?: SimilarityMetric,
    filter?: (chunk: Chunk) => boolean
  ): Promise<RetrievalResult[]> {
    if (!question || question.trim().length === 0) return [];

    const queryVector = await this.embeddingModel.embedQuery(question);
    const selectedMetric = metric || this.defaultMetric;

    return await this.vectorStore.search(queryVector, topK, selectedMetric, filter);
  }
}
```

---

## 3. Generation Engine (`src/pipeline/generation.ts`)

```typescript
import { LLMProvider } from '../llm/base';
import { RetrievalResult, RAGResponse } from '../schemas';

export class GenerationEngine {
  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  async generate(
    question: string,
    contextChunks: RetrievalResult[],
    retrievalLatencyMs: number = 0
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    const answer = await this.llmProvider.generateAnswer(question, contextChunks);
    const generationLatencyMs = Date.now() - startTime;

    return {
      question,
      answer,
      contextChunks,
      metadata: {
        model: this.llmProvider.modelName(),
        retrievalLatencyMs,
        generationLatencyMs,
        totalLatencyMs: retrievalLatencyMs + generationLatencyMs,
      },
    };
  }
}
```

---

## 4. Basic RAG Pipeline Facade (`src/pipeline/basicRag.ts`)

```typescript
import { RAGConfig, defaultConfig } from '../config';
import { DocumentLoader } from '../loaders/base';
import { TextDocumentLoader } from '../loaders/text';
import { TextSplitter } from '../splitters/base';
import { RecursiveCharacterTextSplitter } from '../splitters/character';
import { EmbeddingModel } from '../embeddings/base';
import { MockEmbeddingModel } from '../embeddings/mock';
import { OpenAIEmbeddingModel } from '../embeddings/openai';
import { GeminiEmbeddingModel } from '../embeddings/gemini';
import { VectorStore } from '../vectordb/base';
import { InMemoryVectorStore } from '../vectordb/inMemory';
import { LLMProvider } from '../llm/base';
import { MockLLMProvider } from '../llm/mock';
import { OpenAILLMProvider } from '../llm/openai';
import { GeminiLLMProvider } from '../llm/gemini';
import { IngestionPipeline } from './ingestion';
import { RetrievalEngine } from './retrieval';
import { GenerationEngine } from './generation';
import { Document, Chunk, RAGResponse, SimilarityMetric } from '../schemas';

export class BasicRAGPipeline {
  private config: RAGConfig;
  public loader: DocumentLoader;
  public splitter: TextSplitter;
  public embeddingModel: EmbeddingModel;
  public vectorStore: VectorStore;
  public llmProvider: LLMProvider;

  public ingestion: IngestionPipeline;
  public retrieval: RetrievalEngine;
  public generation: GenerationEngine;

  constructor(
    config?: Partial<RAGConfig>,
    customComponents?: {
      loader?: DocumentLoader;
      splitter?: TextSplitter;
      embeddingModel?: EmbeddingModel;
      vectorStore?: VectorStore;
      llmProvider?: LLMProvider;
    }
  ) {
    this.config = { ...defaultConfig, ...config };

    this.loader = customComponents?.loader ?? new TextDocumentLoader();
    this.splitter =
      customComponents?.splitter ??
      new RecursiveCharacterTextSplitter({
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap,
      });

    this.embeddingModel = customComponents?.embeddingModel ?? this.initEmbeddingModel();
    this.vectorStore = customComponents?.vectorStore ?? new InMemoryVectorStore();
    this.llmProvider = customComponents?.llmProvider ?? this.initLLMProvider();

    this.ingestion = new IngestionPipeline(this.loader, this.splitter, this.embeddingModel, this.vectorStore);
    this.retrieval = new RetrievalEngine(this.embeddingModel, this.vectorStore, this.config.similarityMetric);
    this.generation = new GenerationEngine(this.llmProvider);
  }

  async ingest(filePathOrContent: string): Promise<{ documents: Document[]; chunks: Chunk[]; count: number }> {
    return await this.ingestion.ingest(filePathOrContent);
  }

  async query(question: string, topK?: number, metric?: SimilarityMetric): Promise<RAGResponse> {
    const k = topK || this.config.topK;
    const startRetrieval = Date.now();
    const contextChunks = await this.retrieval.retrieve(question, k, metric);
    const retrievalLatencyMs = Date.now() - startRetrieval;

    return await this.generation.generate(question, contextChunks, retrievalLatencyMs);
  }

  async getIndexedChunkCount(): Promise<number> {
    return await this.vectorStore.count();
  }

  private initEmbeddingModel(): EmbeddingModel {
    if (this.config.embeddingProvider === 'openai') {
      if (!this.config.openaiApiKey) throw new Error('OPENAI_API_KEY is missing.');
      return new OpenAIEmbeddingModel(this.config.openaiApiKey, this.config.openaiEmbeddingModel);
    }
    if (this.config.embeddingProvider === 'gemini') {
      if (!this.config.geminiApiKey) throw new Error('GEMINI_API_KEY is missing.');
      return new GeminiEmbeddingModel(this.config.geminiApiKey, this.config.geminiEmbeddingModel);
    }
    return new MockEmbeddingModel();
  }

  private initLLMProvider(): LLMProvider {
    if (this.config.llmProvider === 'openai') {
      if (!this.config.openaiApiKey) throw new Error('OPENAI_API_KEY is missing.');
      return new OpenAILLMProvider(this.config.openaiApiKey, this.config.openaiLlmModel);
    }
    if (this.config.llmProvider === 'gemini') {
      if (!this.config.geminiApiKey) throw new Error('GEMINI_API_KEY is missing.');
      return new GeminiLLMProvider(this.config.geminiApiKey, this.config.geminiLlmModel);
    }
    return new MockLLMProvider();
  }
}
```
