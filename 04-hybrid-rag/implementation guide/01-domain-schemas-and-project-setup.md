# 🏗️ Chapter 1 — Domain Schemas & System Infrastructure

Welcome to Chapter 1 of the **Hybrid RAG Implementation Guide**. In this chapter, we explore the domain data structures, TypeScript types, and setup files required for building a production-grade Hybrid RAG engine.

All source code snippets in this chapter are taken directly from [`04-hybrid-rag/code`](../code).

---

## 1. Project Configuration Files

### `package.json`

File: [`04-hybrid-rag/code/package.json`](../code/package.json)

```json
{
  "name": "@rag-lab/hybrid-rag",
  "version": "1.0.0",
  "description": "Production-grade Hybrid RAG engine implemented in TypeScript combining Dense Vector Search, Sparse BM25 Search, and Reciprocal Rank Fusion (RRF)",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "hybrid-rag": "dist/cli.js"
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
    "hybrid-rag",
    "reciprocal-rank-fusion",
    "rrf",
    "dense-retrieval",
    "bm25",
    "vector-search",
    "rank-fusion",
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

### `tsconfig.json`

File: [`04-hybrid-rag/code/tsconfig.json`](../code/tsconfig.json)

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
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests/**/*"]
}
```

### `jest.config.js`

File: [`04-hybrid-rag/code/jest.config.js`](../code/jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/cli.ts',
    '!src/index.ts'
  ]
};
```

---

## 2. Complete Domain Schemas (`src/schemas.ts`)

Below is the complete code for [`src/schemas.ts`](../code/src/schemas.ts):

```typescript
/**
 * Domain Schemas and Type Definitions for Hybrid RAG Engine
 */

export interface DocumentMetadata {
  source: string;
  filename?: string;
  fileType?: string;
  createdAt?: string;
  category?: string;
  tags?: string[];
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

export interface DenseRetrievalResult {
  recordId: string;
  chunk: Chunk;
  score: number;       // Cosine similarity score [0..1]
  distance: number;    // Distance metric
  metric: SimilarityMetric;
  rank: number;        // 1-indexed rank position in dense list
}

export interface SparseRetrievalResult {
  docId: string;
  chunk: Chunk;
  score: number;       // BM25 raw score
  matchedTerms: string[];
  rank: number;        // 1-indexed rank position in sparse list
}

export type FusionStrategy = 'rrf' | 'weighted_score' | 'weighted_rrf';

export type ScoreNormalizerType = 'minmax' | 'zscore' | 'softmax' | 'none';

export interface FusionExplanation {
  chunkId: string;
  documentId: string;
  denseRank: number | null;
  denseRawScore: number | null;
  denseNormalizedScore: number | null;
  denseRrfContribution: number | null;

  sparseRank: number | null;
  sparseRawScore: number | null;
  sparseNormalizedScore: number | null;
  sparseRrfContribution: number | null;

  finalHybridScore: number;
  finalRank: number;
  strategyUsed: FusionStrategy;
  mathematicalFormula: string;
}

export interface HybridRetrievalResult {
  chunk: Chunk;
  finalScore: number;
  finalRank: number;
  denseResult?: DenseRetrievalResult;
  sparseResult?: SparseRetrievalResult;
  explanation: FusionExplanation;
}

export interface HybridConfig {
  topK?: number;             // Final top-K results to return (default: 5)
  denseTopK?: number;        // Number of candidates retrieved from Dense index (default: 20)
  sparseTopK?: number;       // Number of candidates retrieved from Sparse index (default: 20)
  fusionStrategy?: FusionStrategy; // Strategy: 'rrf' | 'weighted_score' | 'weighted_rrf' (default: 'rrf')
  rrfK?: number;             // Smoothing constant k for RRF (default: 60)
  alpha?: number;            // Weight for dense search in weighted fusion [0..1] (default: 0.5)
  normalizerType?: ScoreNormalizerType; // Score normalizer algorithm for weighted score fusion (default: 'minmax')
}

export interface RAGResponse {
  question: string;
  answer: string;
  contextChunks: HybridRetrievalResult[];
  metadata: {
    model: string;
    fusionStrategy: FusionStrategy;
    rrfK: number;
    alpha: number;
    denseCandidateCount: number;
    sparseCandidateCount: number;
    totalChunksIndexed: number;
    retrievalLatencyMs?: number;
    generationLatencyMs?: number;
    totalLatencyMs?: number;
  };
}

export interface RankCorrelationResult {
  kendallTau: number;
  spearmanRho: number;
  commonItemCount: number;
  jaccardSimilarity: number;
}

export interface BenchmarkMetrics {
  retrievalLatencyMs: number;
  candidateCount: number;
  topItemIds: string[];
  overlapWithHybridPercent?: number;
}

export interface ComparativeBenchmarkResult {
  query: string;
  denseMetrics: BenchmarkMetrics;
  sparseMetrics: BenchmarkMetrics;
  hybridMetrics: BenchmarkMetrics;
  rankCorrelation: RankCorrelationResult;
}
```

---

## 3. Comprehensive Schema Breakdown & Functionality

| Schema Interface / Type | Purpose & System Functionality | Key Properties Explained |
| :--- | :--- | :--- |
| `Document` | Represents an unchunked raw input document loaded from disk or API. | `id`: Unique document ID.<br>`content`: Full text body.<br>`metadata`: File source path and metadata. |
| `Chunk` | Represents a split text segment indexed into both dense and sparse indexes. | `id`: Unique chunk ID.<br>`content`: Chunk text segment.<br>`metadata`: Includes `documentId`, `chunkIndex`, `startCharIndex`, `endCharIndex`, `tokenCount`. |
| `VectorRecord` | Record stored inside Dense Vector Stores. | `id`: Chunk ID.<br>`vector`: Floating point embedding array.<br>`chunk`: Reference to source Chunk. |
| `DenseRetrievalResult` | Output candidate from Dense Vector Search. | `score`: Similarity score.<br>`distance`: Vector distance.<br>`rank`: 1-indexed rank position in dense list. |
| `SparseRetrievalResult` | Output candidate from Sparse BM25 Search. | `score`: Raw BM25 score.<br>`matchedTerms`: Query terms found in chunk.<br>`rank`: 1-indexed rank position in sparse list. |
| `FusionExplanation` | Detailed mathematical audit trail for a merged candidate. | `denseRank`, `sparseRank`: Rank positions.<br>`denseRrfContribution`, `sparseRrfContribution`: Reciprocal terms $\frac{1}{k + rank}$.<br>`mathematicalFormula`: String math explanation. |
| `HybridRetrievalResult` | Unified candidate output after fusion. | `chunk`: Target Chunk.<br>`finalScore`: Combined score.<br>`finalRank`: Rank position in merged list.<br>`explanation`: Mathematical audit instance. |
| `HybridConfig` | Parameters controlling hybrid search and fusion execution. | `topK`: Final items returned.<br>`denseTopK`, `sparseTopK`: Candidates gathered from each index.<br>`fusionStrategy`: `'rrf'` \| `'weighted_score'` \| `'weighted_rrf'`.<br>`rrfK`: Smoothing constant $k$. |
| `RAGResponse` | Final synthesized answer output from RAG Pipeline. | `question`: User query.<br>`answer`: Generated text.<br>`contextChunks`: Hybrid candidate chunks.<br>`metadata`: Model name, latencies, chunk stats. |

In [Chapter 2](./02-dense-vector-search-subsystem.md), we will build the **Dense Vector Search Subsystem**.
