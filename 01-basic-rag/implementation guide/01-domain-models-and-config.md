# Chapter 1 — Core Domain Models, System Configuration & Environment Setup

In a production-grade RAG engine, strongly-typed domain contracts, centralized configuration management, and clean project build definitions establish the core foundation.

In this chapter, we cover:
1. **Environment & Project Configuration**: [package.json](file:///home/aminul/development/rag-lab/01-basic-rag/code/package.json), [tsconfig.json](file:///home/aminul/development/rag-lab/01-basic-rag/code/tsconfig.json), [jest.config.js](file:///home/aminul/development/rag-lab/01-basic-rag/code/jest.config.js), [.env.example](file:///home/aminul/development/rag-lab/01-basic-rag/code/.env.example).
2. **Core Domain Schemas**: [src/schemas.ts](file:///home/aminul/development/rag-lab/01-basic-rag/code/src/schemas.ts) — Data models for documents, chunks, vectors, retrieval scores, and RAG responses.
3. **System Configuration**: [src/config.ts](file:///home/aminul/development/rag-lab/01-basic-rag/code/src/config.ts) — Centralized hyperparameter configuration and environment variable loading.
4. **Public Module Exports Barrel**: [src/index.ts](file:///home/aminul/development/rag-lab/01-basic-rag/code/src/index.ts) — Clean library exports.

---

## 1. Project Setup & Build Configuration

Before writing application logic, we establish our TypeScript build configuration, dependency manifest, Jest test runner settings, and environment variable defaults.

### 1.1 Dependency Manifest ([package.json](file:///home/aminul/development/rag-lab/01-basic-rag/code/package.json))

```json
{
  "name": "@rag-lab/basic-rag",
  "version": "1.0.0",
  "description": "Production-grade Basic (Naive) RAG engine implemented in TypeScript",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "basic-rag": "dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "ts-node src/cli.ts",
    "test": "jest",
    "test:coverage": "jest --coverage"
  },
  "keywords": [
    "rag",
    "retrieval-augmented-generation",
    "vector-search",
    "embeddings",
    "llm",
    "typescript"
  ],
  "author": "RAG Lab",
  "license": "MIT",
  "dependencies": {
    "commander": "^12.0.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.0"
  }
}
```

#### 💡 Design & Rationale:
- **`dependencies`**: Keeps runtime dependencies ultra-lightweight. Only `commander` (for building the CLI) and `dotenv` (for `.env` variable parsing) are required. Native Node.js `fetch` (available in Node.js 18+) is used for external API calls.
- **`devDependencies`**: Provides static typing (`@types/node`, `@types/jest`), the TypeScript compiler (`typescript`), and the test runner (`jest`, `ts-jest`).

---

### 1.2 Compiler Options ([tsconfig.json](file:///home/aminul/development/rag-lab/01-basic-rag/code/tsconfig.json))

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests/**/*"]
}
```

#### 💡 Design & Rationale:
- **`"target": "ES2022"`**: Enables modern JavaScript features including top-level `async/await`, class fields, and standard array/string methods.
- **`"strict": true`**: Enforces strict null checks (`strictNullChecks`) and prevents implicit `any` types across the entire codebase.
- **`"declaration": true`**: Generates TypeScript declaration files (`.d.ts`) when compiled into `./dist`.

---

### 1.3 Test Suite Configuration ([jest.config.js](file:///home/aminul/development/rag-lab/01-basic-rag/code/jest.config.js))

```javascript
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/cli.ts',
    '!src/index.ts'
  ]
};
```

---

### 1.4 Environment Variable Template ([.env.example](file:///home/aminul/development/rag-lab/01-basic-rag/code/.env.example))

```ini
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_LLM_MODEL=gpt-4o-mini

# Gemini Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_EMBEDDING_MODEL=models/embedding-001
GEMINI_LLM_MODEL=gemini-1.5-flash

# Default Pipeline Settings
RAG_EMBEDDING_PROVIDER=mock  # Options: mock, openai, gemini
RAG_LLM_PROVIDER=mock        # Options: mock, openai, gemini
RAG_CHUNK_SIZE=500
RAG_CHUNK_OVERLAP=50
RAG_TOP_K=3
RAG_SIMILARITY_METRIC=cosine # Options: cosine, dot_product, euclidean
```

---

## 2. Core Domain Schemas ([src/schemas.ts](file:///home/aminul/development/rag-lab/01-basic-rag/code/src/schemas.ts))

The domain schemas define the data structures flowing through every stage of the RAG pipeline.

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

1. **`DocumentMetadata` & `Document`**:
   - `Document` represents an entire ingested text document or file.
   - `DocumentMetadata` captures document provenance (`source`, `filename`, `fileType`, `createdAt`) and supports arbitrary key-value pairs via index signature `[key: string]: unknown`.

2. **`ChunkMetadata` & `Chunk`**:
   - `Chunk` represents a smaller substring produced by splitting a `Document`.
   - `ChunkMetadata` extends `DocumentMetadata`, appending chunk indexing properties (`documentId`, `chunkIndex`, `totalChunks`, `startCharIndex`, `endCharIndex`, `tokenCount`). This ensures full traceabilty back to original document positions.

3. **`VectorRecord`**:
   - Standard format indexed in the vector store.
   - `vector` contains the $d$-dimensional floating point numbers (`number[]`).
   - Stores direct references to the source `chunk` and metadata for fast zero-lookup response generation.

4. **`SimilarityMetric` & `RetrievalResult`**:
   - `SimilarityMetric` enforces type safety for similarity calculation algorithms (`'cosine'`, `'dot_product'`, `'euclidean'`).
   - `RetrievalResult` pairs a retrieved `chunk` with its similarity score.

5. **`RAGResponse`**:
   - The primary response envelope returned to callers. It bundles the original `question`, synthesized `answer`, top context chunks used for context injection, and execution latency metrics.

---

## 3. System Configuration ([src/config.ts](file:///home/aminul/development/rag-lab/01-basic-rag/code/src/config.ts))

Centralized system configuration handles pipeline defaults and loads environment variables cleanly.

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

### 💡 Code Explanation & Key Details

1. **`defaultConfig`**:
   - Provides out-of-the-box fallback defaults (`chunkSize: 500`, `chunkOverlap: 50`, `topK: 3`, `embeddingProvider: 'mock'`, `llmProvider: 'mock'`).
   - Ensures the system runs offline without external API keys out of the box.

2. **`loadConfigFromEnv()`**:
   - Merges process environment variables with `defaultConfig`.
   - Parses integer values (`RAG_CHUNK_SIZE`, `RAG_CHUNK_OVERLAP`, `RAG_TOP_K`) using `parseInt(..., 10)`.
   - Resolves provider choices dynamically for OpenAI or Google Gemini integration.

---

## 4. Public Library Barrel ([src/index.ts](file:///home/aminul/development/rag-lab/01-basic-rag/code/src/index.ts))

To expose all public contracts and classes when consumed as a library, `src/index.ts` re-exports all modules:

```typescript
// Export schemas
export * from './schemas';

// Export config
export * from './config';

// Export interfaces & implementations
export * from './loaders/base';
export * from './loaders/text';

export * from './splitters/base';
export * from './splitters/character';
export * from './splitters/token';

export * from './embeddings/base';
export * from './embeddings/mock';
export * from './embeddings/openai';
export * from './embeddings/gemini';

export * from './vectordb/base';
export * from './vectordb/inMemory';

export * from './llm/base';
export * from './llm/mock';
export * from './llm/openai';
export * from './llm/gemini';

export * from './pipeline/ingestion';
export * from './pipeline/retrieval';
export * from './pipeline/generation';
export * from './pipeline/basicRag';
```
