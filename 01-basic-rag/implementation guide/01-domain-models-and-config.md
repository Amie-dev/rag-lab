# Chapter 1 — Core Domain Models & System Configuration

In a production-grade software application, having clear, strongly-typed data contracts (schemas) and structured configuration management is essential.

In this chapter, we build:
1. `src/schemas.ts` — The core domain models (`Document`, `Chunk`, `VectorRecord`, `RetrievalResult`, `RAGResponse`).
2. `src/config.ts` — Centralized configuration settings and environment variable loading.

---

## 1. Core Domain Schemas (`src/schemas.ts`)

The domain schemas define the objects that flow through each stage of the RAG pipeline.

### Full Source Code

```typescript
/**
 * Domain Schemas and Data Models for Basic RAG Engine
 */

export interface DocumentMetadata {
  source: string;
  filename?: string;
  fileType?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

export interface ChunkMetadata extends DocumentMetadata {
  documentId: string;
  chunkIndex: number;
  totalChunks?: number;
  startCharIndex?: number;
  endCharIndex?: number;
  tokenCount?: number;
}

export interface Chunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
}

export interface VectorRecord {
  id: string;
  vector: number[];
  chunk: Chunk;
  metadata: ChunkMetadata;
}

export type SimilarityMetric = 'cosine' | 'dot_product' | 'euclidean';

export interface RetrievalResult {
  chunk: Chunk;
  score: number;
  metric: SimilarityMetric;
}

export interface RAGResponse {
  question: string;
  answer: string;
  contextChunks: RetrievalResult[];
  metadata: {
    model: string;
    totalTokensUsed?: number;
    retrievalLatencyMs?: number;
    generationLatencyMs?: number;
    totalLatencyMs?: number;
  };
}
```

### 💡 Code Explanation & Design Rationale

1. **`Document`**: Represents a raw ingested file or text payload before chunking.
   - `id`: Unique identifier for the parent document.
   - `content`: Raw text string extracted from the document source.
   - `metadata`: Source file path, filename, creation timestamp, and arbitrary user tags.

2. **`Chunk`**: Represents a small snippet created by splitting a `Document`.
   - `metadata`: Inherits parent document metadata and adds chunk provenance (`documentId`, `chunkIndex`, `startCharIndex`, `endCharIndex`, `tokenCount`). This is crucial for tracing answers back to exact document locations.

3. **`VectorRecord`**: The format stored inside the vector database.
   - `vector`: An array of floating-point numbers (`number[]`) computed by the embedding model.
   - `chunk`: Reference to the original `Chunk` data.

4. **`RetrievalResult`**: Returned by similarity search.
   - `score`: The similarity score (higher is more relevant).
   - `metric`: The similarity formula used (`cosine`, `dot_product`, or `euclidean`).

5. **`RAGResponse`**: The final output returned to the caller, containing the user question, generated answer, context chunks used, and performance latency metrics.

---

## 2. System Configuration (`src/config.ts`)

System configuration handles default hyperparameters (chunk size, overlap, top-k, similarity metric) and loads environment variables cleanly.

### Full Source Code

```typescript
import { SimilarityMetric } from './schemas';

export interface RAGConfig {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityMetric: SimilarityMetric;
  embeddingProvider: 'mock' | 'openai' | 'gemini';
  llmProvider: 'mock' | 'openai' | 'gemini';
  openaiApiKey?: string;
  openaiEmbeddingModel?: string;
  openaiLlmModel?: string;
  geminiApiKey?: string;
  geminiEmbeddingModel?: string;
  geminiLlmModel?: string;
}

export const defaultConfig: RAGConfig = {
  chunkSize: 500,
  chunkOverlap: 50,
  topK: 3,
  similarityMetric: 'cosine',
  embeddingProvider: 'mock',
  llmProvider: 'mock',
  openaiEmbeddingModel: 'text-embedding-3-small',
  openaiLlmModel: 'gpt-4o-mini',
  geminiEmbeddingModel: 'models/embedding-001',
  geminiLlmModel: 'gemini-1.5-flash',
};

export function loadConfigFromEnv(): RAGConfig {
  return {
    ...defaultConfig,
    chunkSize: process.env.RAG_CHUNK_SIZE ? parseInt(process.env.RAG_CHUNK_SIZE, 10) : defaultConfig.chunkSize,
    chunkOverlap: process.env.RAG_CHUNK_OVERLAP ? parseInt(process.env.RAG_CHUNK_OVERLAP, 10) : defaultConfig.chunkOverlap,
    topK: process.env.RAG_TOP_K ? parseInt(process.env.RAG_TOP_K, 10) : defaultConfig.topK,
    similarityMetric: (process.env.RAG_SIMILARITY_METRIC as SimilarityMetric) || defaultConfig.similarityMetric,
    embeddingProvider: (process.env.RAG_EMBEDDING_PROVIDER as 'mock' | 'openai' | 'gemini') || defaultConfig.embeddingProvider,
    llmProvider: (process.env.RAG_LLM_PROVIDER as 'mock' | 'openai' | 'gemini') || defaultConfig.llmProvider,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || defaultConfig.openaiEmbeddingModel,
    openaiLlmModel: process.env.OPENAI_LLM_MODEL || defaultConfig.openaiLlmModel,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || defaultConfig.geminiEmbeddingModel,
    geminiLlmModel: process.env.GEMINI_LLM_MODEL || defaultConfig.geminiLlmModel,
  };
}
```

### 💡 Code Explanation & Design Rationale

- **`defaultConfig`**: Provides sensible defaults (`chunkSize: 500`, `chunkOverlap: 50`, `topK: 3`, `embeddingProvider: 'mock'`) allowing the pipeline to execute out-of-the-box without requiring complex setup or API keys.
- **`loadConfigFromEnv()`**: Reads environment variables (such as `OPENAI_API_KEY`, `RAG_TOP_K`), overriding defaults dynamically.
