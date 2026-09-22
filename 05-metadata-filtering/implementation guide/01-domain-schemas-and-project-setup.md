# 🏗️ Chapter 1 — Domain Schemas & System Infrastructure

Welcome to Chapter 1 of the **Metadata-Filtered RAG Implementation Guide**. In this chapter, we explore the domain data structures, TypeScript types, metadata filter AST schemas, API DTOs, and project setup required for building a production-grade Metadata-Filtered RAG engine.

All source code snippets in this chapter are taken directly from [`05-metadata-filtering/code`](../code).

---

## 1. Project Configuration & Build Setup

### `package.json`

File: [`05-metadata-filtering/code/package.json`](../code/package.json)

```json
{
  "name": "@rag-lab/metadata-filtered-rag",
  "version": "1.0.0",
  "description": "Production-grade Metadata-Filtered RAG Engine with Express Backend, Pre/Post Filtering, Multi-Tenant Security, REST APIs, and CLI",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "metadata-rag": "dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "ts-node src/server.ts",
    "dev": "ts-node src/server.ts",
    "cli": "ts-node src/cli.ts",
    "test": "jest",
    "test:coverage": "jest --coverage"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.0",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.0"
  }
}
```

### `tsconfig.json`

File: [`05-metadata-filtering/code/tsconfig.json`](../code/tsconfig.json)

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

---

## 2. Document & Chunk Domain Schemas

File: [`05-metadata-filtering/code/src/types/document.types.ts`](../code/src/types/document.types.ts)

```typescript
export interface DocumentMetadata {
  tenant_id: string;
  user_id?: string;
  department?: string;
  created_at?: string; // ISO 8601 string, e.g. "2026-08-15"
  file_type?: string;  // e.g. "pdf", "docx", "txt", "md"
  document_type?: string; // e.g. "policy", "report", "specification"
  language?: string;   // e.g. "en", "es", "fr"
  access_level?: number; // e.g. 1 (public), 2 (employee), 3 (manager), 4 (exec)
  project_id?: string;
  source?: string;
  is_public?: boolean;
  [key: string]: unknown;
}

export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

export interface ChunkMetadata extends DocumentMetadata {
  document_id: string;
  chunk_index: number;
  total_chunks?: number;
  start_char?: number;
  end_char?: number;
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
```

---

## 3. Metadata Filtering Expression Schemas

File: [`05-metadata-filtering/code/src/types/filter.types.ts`](../code/src/types/filter.types.ts)

```typescript
import { Chunk } from './document.types';

export type FilterValue = string | number | boolean | Array<string | number>;

export type ComparisonOperator =
  | '$eq'
  | '$ne'
  | '$gt'
  | '$gte'
  | '$lt'
  | '$lte'
  | '$in'
  | '$nin'
  | '$contains';

export type ConditionFilter = {
  [K in ComparisonOperator]?: FilterValue;
};

export type FieldFilter = FilterValue | ConditionFilter;

export interface MetadataFilter {
  $and?: MetadataFilter[];
  $or?: MetadataFilter[];
  $not?: MetadataFilter;
  [field: string]: FieldFilter | MetadataFilter[] | MetadataFilter | undefined;
}

export type SearchMode = 'pre-filter' | 'post-filter';

export interface RetrievalResult {
  chunk: Chunk;
  score: number;
  recordId: string;
  metadataMatch: boolean;
}
```

---

## 4. API Data Transfer Objects (DTOs)

File: [`05-metadata-filtering/code/src/types/api.types.ts`](../code/src/types/api.types.ts)

```typescript
import { MetadataFilter, SearchMode } from './filter.types';

export interface AuthenticatedUser {
  user_id: string;
  tenant_id: string;
  department?: string;
  departments?: string[];
  access_level: number;
  roles?: string[];
}

export interface IngestDocumentDTO {
  id?: string;
  content: string;
  metadata: {
    tenant_id: string;
    department?: string;
    file_type?: string;
    access_level?: number;
    [key: string]: unknown;
  };
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface SearchQueryDTO {
  query: string;
  filter?: MetadataFilter;
  topK?: number;
  mode?: SearchMode;
  postFilterCandidateLimit?: number;
  bypassAuthGuard?: boolean;
}
```
