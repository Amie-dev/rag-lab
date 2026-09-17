# Chapter 1 — Project Infrastructure & Domain Type Schemas

This chapter outlines the project configuration, TypeScript setup, build toolchain, and domain data schemas for `@rag-lab/vector-rag`.

All schema definitions reside in [`src/schemas.ts`](../code/src/schemas.ts).

---

## 1. Project Infrastructure Configuration

### A. Package Manifest ([`package.json`](../code/package.json))

The engine is packaged as an npm TypeScript module `@rag-lab/vector-rag` with CLI binary support:

```json
{
  "name": "@rag-lab/vector-rag",
  "version": "1.0.0",
  "description": "Production-grade Vector RAG engine implemented in TypeScript with HNSW & IVF ANN indexes",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "vector-rag": "dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "ts-node src/cli.ts",
    "test": "jest"
  },
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

### B. TypeScript Compiler Config ([`tsconfig.json`](../code/tsconfig.json))

Configured with `strict: true` targeting `ES2022`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

---

## 2. Domain Data Model Schemas

The domain schema [`src/schemas.ts`](../code/src/schemas.ts) establishes strict type safety across documents, chunks, vectors, indexes, and responses.

### A. Document & Chunk Interfaces

```typescript
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
```

### B. Vector Record & Index Configuration Interfaces

```typescript
export interface VectorRecord {
  id: string;
  vector: number[];
  chunk: Chunk;
  metadata: ChunkMetadata;
}

export type SimilarityMetric = 'cosine' | 'dot_product' | 'euclidean' | 'manhattan';

export type IndexType = 'flat' | 'hnsw' | 'ivf';

export interface HNSWConfig {
  M?: number;              // Max connections per node per layer (e.g. 16)
  efConstruction?: number; // Dynamic candidate queue size during build (e.g. 64)
  efSearch?: number;       // Dynamic candidate queue size during search (e.g. 32)
}

export interface IVFConfig {
  numLists?: number;       // Number of centroids/clusters (e.g. 8)
  nprobe?: number;         // Number of centroid lists to probe during search (e.g. 3)
  kmeansIterations?: number;
}

export interface IndexConfig {
  type: IndexType;
  hnsw?: HNSWConfig;
  ivf?: IVFConfig;
}
```

### C. Metadata Filtering Schemas

Supports MongoDB-style operator expressions:

```typescript
export type FilterOperator = '$eq' | '$ne' | '$gt' | '$gte' | '$lt' | '$lte' | '$in' | '$nin';

export type MetadataValue = string | number | boolean | Array<string | number>;

export interface ConditionFilter {
  [operator: string]: MetadataValue;
}

export type FieldFilter = MetadataValue | ConditionFilter;

export interface MetadataFilter {
  $and?: MetadataFilter[];
  $or?: MetadataFilter[];
  [field: string]: FieldFilter | MetadataFilter[] | undefined;
}
```

### D. Pipeline Response & Benchmark Interfaces

```typescript
export interface RetrievalResult {
  chunk: Chunk;
  score: number;
  distance: number;
  metric: SimilarityMetric;
  recordId: string;
}

export interface RAGResponse {
  question: string;
  answer: string;
  contextChunks: RetrievalResult[];
  metadata: {
    model: string;
    indexType: IndexType;
    similarityMetric: SimilarityMetric;
    totalTokensUsed?: number;
    retrievalLatencyMs?: number;
    generationLatencyMs?: number;
    totalLatencyMs?: number;
  };
}

export interface BenchmarkResult {
  indexType: IndexType;
  totalRecords: number;
  dimension: number;
  indexingTimeMs: number;
  searchLatencyMs: number;
  recallAtK: number;
  avgSimilarityScore: number;
}
```
