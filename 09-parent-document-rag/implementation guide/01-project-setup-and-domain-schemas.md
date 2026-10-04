# Chapter 1 — Project Setup & Domain Schemas

## 🛠️ Repository & Project Organization

The production codebase for the Parent-Document RAG Engine resides in [`09-parent-document-rag/code`](../code).

```text
09-parent-document-rag/code/
├── package.json               # Node.js dependencies & npm scripts
├── tsconfig.json              # TypeScript ES2022 compiler configuration
├── jest.config.js             # Test runner & coverage threshold settings
├── .env.example               # Environment variables template
├── sample_data/
│   └── documents.json         # Real-world multi-section dataset (HR, Billing, Auth, DB, Cache, RAG)
├── src/
│   ├── types/
│   │   └── index.ts                 # Core domain interfaces & Zod validation schemas
│   ├── config/
│   │   └── environment.ts           # Validated environment configuration loader
│   ├── services/
│   │   ├── embedding.service.ts          # 1536D OpenAI / Local Hashing Embeddings
│   │   ├── chunking.service.ts           # Hierarchical parent/child chunker (THE core)
│   │   ├── parent-store.service.ts       # Parent chunk store (generation context)
│   │   ├── vector-store.service.ts       # Child chunk vector index (retrieval units)
│   │   ├── bm25.service.ts               # Okapi BM25 lexical keyword search over children
│   │   ├── result-merger.service.ts      # RRF / Score-Weighted / Max-Score fusion
│   │   ├── reranker.service.ts           # Cross-encoder child re-scoring subsystem
│   │   ├── parent-resolver.service.ts    # Child → parent resolution, dedup, context budget
│   │   ├── llm.service.ts                # Grounded OpenAI Structured Output synthesizer
│   │   ├── indexing.service.ts           # Ingestion orchestration (chunk → store → index)
│   │   ├── parent-document-rag.service.ts# Pipeline orchestrator (search & RAG)
│   │   └── benchmark.service.ts          # Comparative benchmarking engine
│   ├── controllers/
│   │   └── parent-document.controller.ts # Express controller methods
│   ├── routes/
│   │   └── parent-document.routes.ts     # Express REST routes with Zod validation
│   ├── middlewares/
│   │   ├── error.middleware.ts           # Global Express error handler
│   │   └── validation.middleware.ts      # Zod schema validation middleware
│   ├── app.ts                 # Express app factory & sample-data initializer
│   ├── server.ts              # HTTP server entry point
│   ├── cli.ts                 # Interactive Commander CLI
│   └── index.ts               # Package exports
└── tests/                     # Jest unit & integration test suites
```

### Build Tooling (`package.json`, `tsconfig.json`, `jest.config.js`)

- **Language**: TypeScript compiled to `CommonJS`/`ES2022`, targeting `dist/` ([`tsconfig.json`](../code/tsconfig.json)).
- **Strict mode** is on (`"strict": true`), so every domain type must be explicit.
- **Runtime deps**: `express`, `cors`, `dotenv`, `openai`, `zod`, `commander`.
- **npm scripts**: `build` (`tsc`), `start` (`ts-node src/server.ts`), `cli`, `test`, `test:coverage`.

```jsonc
// package.json (scripts excerpt)
"scripts": {
  "build": "tsc",
  "start": "ts-node src/server.ts",
  "cli": "ts-node src/cli.ts",
  "test": "jest",
  "test:coverage": "jest --coverage"
}
```

---

## 📋 Comprehensive Domain Interfaces

In [`src/types/index.ts`](../code/src/types/index.ts), every entity in the two-level hierarchy is strictly typed. The **central idea is the `parentId` link**: children point at their parent so retrieval can "hop up" from a small match to a large context.

```typescript
/**
 * Flexible metadata bag attached to documents, parents, and children.
 */
export interface DocumentMetadata {
  title?: string;
  category?: string;
  section?: string;
  tags?: string[];
  source?: string;
  [key: string]: any;
}

/**
 * A raw ingested document (whole file / record) prior to hierarchy construction.
 */
export interface Document {
  id: string;
  content: string;
  metadata?: DocumentMetadata;
}

/**
 * A PARENT chunk is a large, coherent contextual unit (section-scale).
 * Parents are NOT embedded/indexed for retrieval — they exist to provide
 * complete generation context once a matching child is found.
 */
export interface ParentChunk {
  id: string;
  documentId: string;
  content: string;
  parentIndex: number;
  totalParents: number;
  childCount: number;
  childIds: string[];
  tokenEstimate: number;
  metadata: DocumentMetadata;
}

/**
 * A CHILD chunk is a small, precise retrieval unit derived from a parent.
 * Children are embedded and indexed for high-precision semantic matching and
 * carry a strict `parentId` reference back to their parent.
 */
export interface ChildChunk {
  id: string;
  parentId: string;   // ← the "small → big" pointer
  documentId: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  tokenEstimate: number;
  metadata: DocumentMetadata;
  embedding?: number[];
}
```

> 🔑 **`ParentChunk.childIds`** and **`ChildChunk.parentId`** are the two halves of the bidirectional link that makes parent resolution possible. `ParentChunk` also pre-computes `tokenEstimate` so budgeting (Chapter 5) never has to re-count tokens.

### Retrieval & Resolution Contracts

```typescript
/** A single dense or sparse match over the CHILD index. */
export interface ChildSearchHit {
  child: ChildChunk;
  score: number;
  searchMethod: 'child_dense' | 'child_bm25';
  rank: number;
}

/** A fused, deduplicated CHILD candidate from one or more retrieval passes. */
export interface MergedChildCandidate {
  child: ChildChunk;
  parentId: string;
  finalScore: number;
  rrfScore?: number;
  occurrences: number;
  retrievedByMethods: string[];
}

/** A resolved PARENT context ready for the generation LLM. */
export interface ParentContext {
  parent: ParentChunk;
  resolvedFromChildIds: string[];   // evidence trail
  contributingChildCount: number;
  bestChildScore: number;
  aggregateScore: number;
  rankScore: number;                // final parent ranking score
  retrievedByMethods: string[];
  tokenEstimate: number;
}

export type FusionStrategy = 'rrf' | 'score_weighted' | 'max_score';
export type RetrievalMode = 'vector_only' | 'hybrid';
export type ContextScoreAggregation = 'best_child' | 'mean_child' | 'sum_child';

/** Diagnostics describing how children were collapsed into parent contexts. */
export interface ParentResolutionResult {
  parentContexts: ParentContext[];
  uniqueParentCount: number;
  totalCandidateChildren: number;
  deduplicatedChildren: number;
  totalContextTokens: number;
  droppedByParentLimit: number;
  droppedByBudget: number;
  budgetExceeded: boolean;
  scoreAggregation: ContextScoreAggregation;
}
```

Notice that `ParentResolutionResult` exposes **observability** fields (`droppedByBudget`, `budgetExceeded`, `deduplicatedChildren`). A senior engineer always surfaces *why* context was truncated instead of silently dropping it.

---

## 🔌 Zod Schemas — API Request Contracts

The same file declares Zod schemas that validate every incoming HTTP body and define the structured LLM answer. Zod gives **runtime validation + compile-time types** from one definition.

```typescript
export const ChunkingConfigSchema = z.object({
  parentChunkSize: z.number().int().min(200).max(20000).optional(),
  parentChunkOverlap: z.number().int().min(0).max(5000).optional(),
  childChunkSize: z.number().int().min(50).max(10000).optional(),
  childChunkOverlap: z.number().int().min(0).max(5000).optional(),
});

export const IngestDocumentsSchema = z.object({
  documents: z
    .array(
      z.object({
        id: z.string().min(1, 'Document id cannot be empty'),
        content: z.string().min(1, 'Document content cannot be empty'),
        metadata: z.record(z.any()).optional(),
      })
    )
    .min(1, 'At least one document is required'),
  chunking: ChunkingConfigSchema.optional(),
});

export const ParentDocumentSearchSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  childTopK: z.number().int().min(1).max(50).default(12),
  finalChildTopK: z.number().int().min(1).max(50).default(8),
  maxParents: z.number().int().min(1).max(25).default(4),
  maxContextTokens: z.number().int().min(100).max(50000).default(3000),
  fusionStrategy: z.enum(['rrf', 'score_weighted', 'max_score']).default('rrf'),
  retrievalMode: z.enum(['vector_only', 'hybrid']).default('hybrid'),
  enableReranking: z.boolean().default(true),
  scoreAggregation: z.enum(['best_child', 'mean_child', 'sum_child']).default('mean_child'),
});

export type ParentDocumentSearchRequest = z.input<typeof ParentDocumentSearchSchema>;
```

The **RAG** schema is identical except its primary field is `question` instead of `query`. Both `.default(...)` values let a client send `{}` and still get sensible behaviour.

### Structured Grounded-Answer Schema (OpenAI Structured Outputs)

```typescript
export const GroundedAnswerSchema = z.object({
  answer: z.string().describe('Factually grounded answer synthesized strictly from the real parent context provided.'),
  confidenceScore: z.number().min(0).max(1).describe('Confidence 0..1 reflecting alignment with the parent context.'),
  citedParentIds: z.array(z.string()).describe('Parent chunk IDs cited as evidence in the answer.'),
  keyInsights: z.array(z.string()).describe('Bullet points highlighting core insights drawn from the parent context.'),
});

export type GroundedAnswerResponse = z.infer<typeof GroundedAnswerSchema>;
```

> 💡 The `.describe(...)` calls are not decoration — OpenAI's Structured Outputs uses them as field-level guidance for the model. They are consumed in [Chapter 6](./06-grounded-generation-and-orchestration.md).

---

## ⚙️ Environment Configuration Loader

In [`src/config/environment.ts`](../code/src/config/environment.ts), environment settings are validated at startup with **Zod transforms** so strings like `"1500"` become numbers and `"true"` becomes a boolean.

```typescript
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const toInt = (val: string) => parseInt(val, 10);
const toBool = (val: string) => val === 'true';

const environmentSchema = z.object({
  PORT: z.string().transform(toInt).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_COMPLETION_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),

  // Hierarchical chunking (sizes in characters, ~4 chars/token)
  DEFAULT_PARENT_CHUNK_SIZE: z.string().transform(toInt).default('1500'),
  DEFAULT_PARENT_CHUNK_OVERLAP: z.string().transform(toInt).default('200'),
  DEFAULT_CHILD_CHUNK_SIZE: z.string().transform(toInt).default('350'),
  DEFAULT_CHILD_CHUNK_OVERLAP: z.string().transform(toInt).default('60'),

  // Retrieval / resolution
  DEFAULT_CHILD_TOP_K: z.string().transform(toInt).default('12'),
  DEFAULT_FINAL_CHILD_TOP_K: z.string().transform(toInt).default('8'),
  DEFAULT_MAX_PARENTS: z.string().transform(toInt).default('4'),
  DEFAULT_MAX_CONTEXT_TOKENS: z.string().transform(toInt).default('3000'),
  DEFAULT_ENABLE_RERANKING: z.string().transform(toBool).default('true'),
});
```

The parser is **fail-safe**: if a value is malformed it logs a warning and falls back to sane defaults so the service still boots (a pattern we carry through the whole codebase). The result is exposed as a normalized, camelCased `config` object:

```typescript
export const config = {
  port: parsedConfig.PORT,
  nodeEnv: parsedConfig.NODE_ENV,
  openaiApiKey: parsedConfig.OPENAI_API_KEY,
  openaiCompletionModel: parsedConfig.OPENAI_COMPLETION_MODEL,
  openaiEmbeddingModel: parsedConfig.OPENAI_EMBEDDING_MODEL,

  defaultParentChunkSize: parsedConfig.DEFAULT_PARENT_CHUNK_SIZE,
  defaultParentChunkOverlap: parsedConfig.DEFAULT_PARENT_CHUNK_OVERLAP,
  defaultChildChunkSize: parsedConfig.DEFAULT_CHILD_CHUNK_SIZE,
  defaultChildChunkOverlap: parsedConfig.DEFAULT_CHILD_CHUNK_OVERLAP,

  defaultChildTopK: parsedConfig.DEFAULT_CHILD_TOP_K,
  defaultFinalChildTopK: parsedConfig.DEFAULT_FINAL_CHILD_TOP_K,
  defaultMaxParents: parsedConfig.DEFAULT_MAX_PARENTS,
  defaultMaxContextTokens: parsedConfig.DEFAULT_MAX_CONTEXT_TOKENS,
  defaultEnableReranking: parsedConfig.DEFAULT_ENABLE_RERANKING,
};
```

> 🧩 **Default parameter rationale**: parents are ~1500 chars (~375 tokens) and children ~350 chars (~80 tokens). With `maxParents=4`, worst-case context is ~1500 tokens — comfortably inside a modern LLM window, and the `maxContextTokens=3000` budget leaves headroom.

### Try It Yourself

```bash
cd 09-parent-document-rag/code
npm install
npx tsc --noEmit          # type-check everything
```

Next, proceed to **[Chapter 2 — Hierarchical Chunking & Dual Stores](./02-hierarchical-chunking-and-dual-stores.md)**.

