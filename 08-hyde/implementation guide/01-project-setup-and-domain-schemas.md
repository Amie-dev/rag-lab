# Chapter 1 — Project Setup & Domain Schemas

## 🛠️ Repository & Project Organization

The production codebase for the HyDE RAG Engine resides in [`08-hyde/code`](../code).

```text
08-hyde/code/
├── package.json               # Node.js dependencies & scripts
├── tsconfig.json              # TypeScript ES2022 compiler configuration
├── jest.config.js             # Test runner & coverage threshold settings
├── .env.example               # Environment variables template
├── sample_data/
│   └── documents.json         # Real-world technical dataset (RAG, DB, Auth, Infra)
├── src/
│   ├── types/
│   │   └── index.ts           # Core domain interfaces & Zod validation schemas
│   ├── config/
│   │   └── environment.ts     # Validated environment configuration loader
│   ├── services/
│   │   ├── embedding.service.ts      # 1536D OpenAI / Local Hashing Embeddings
│   │   ├── hyde-generator.service.ts # Domain-tailored Hypothetical Doc Generator
│   │   ├── bm25.service.ts           # Okapi BM25 Lexical Keyword Search
│   │   ├── vector-store.service.ts   # In-Memory Vector Store & Text Chunker
│   │   ├── result-merger.service.ts  # RRF & Score Fusion Merger
│   │   ├── reranker.service.ts       # Cross-Encoder Re-scoring Subsystem
│   │   ├── hyde-rag.service.ts       # Pipeline Orchestrator (Search & RAG)
│   │   ├── llm.service.ts            # Grounded OpenAI Structured Output Synthesizer
│   │   └── benchmark.service.ts      # Strategy Benchmarking Engine
│   ├── controllers/
│   │   └── hyde.controller.ts # Express Controller methods
│   ├── routes/
│   │   └── hyde.routes.ts     # Express REST API routes with Zod validation
│   ├── middlewares/
│   │   ├── error.middleware.ts       # Global Express error handler
│   │   └── validation.middleware.ts  # Zod schema validation middleware
│   ├── app.ts                 # Express Application factory & sample data initializer
│   ├── server.ts              # HTTP Server entry point
│   ├── cli.ts                 # Interactive Commander CLI
│   └── index.ts               # Package exports
└── tests/                     # Jest unit & integration test suites
```

---

## 📋 Comprehensive Domain Interfaces

In [`src/types/index.ts`](../code/src/types/index.ts), all domain entities are strictly typed:

```typescript
import { z } from 'zod';

export interface DocumentMetadata {
  title?: string;
  category?: string;
  tags?: string[];
  source?: string;
  [key: string]: any;
}

export interface Document {
  id: string;
  content: string;
  metadata?: DocumentMetadata;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  metadata: DocumentMetadata;
  embedding?: number[];
}

export interface HypotheticalDocument {
  id: string;
  originalQuery: string;
  hypotheticalText: string;
  domainContext: string;
  embedding?: number[];
  createdAt: string;
}

export interface SearchHit {
  chunk: DocumentChunk;
  score: number;
  searchMethod: 'hyde_vector' | 'direct_vector' | 'bm25' | 'hybrid';
  hypotheticalDocId?: string;
}

export interface MergedCandidateChunk {
  chunk: DocumentChunk;
  finalScore: number;
  rrfScore?: number;
  occurrences: number;
  retrievedByMethods: string[];
  hypotheticalDocsUsed: string[];
}

export type FusionStrategy = 'rrf' | 'score_weighted' | 'max_score';
export type RetrievalMode = 'vector_only' | 'hybrid';
export type DomainContext = 'technical' | 'general' | 'legal' | 'medical' | 'financial';
```

---

## 🛡️ Zod API Request & Response Schemas

Validation schemas decouple user input parsing from business logic:

```typescript
export const HypotheticalDocGenerationSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  numDocs: z.number().min(1).max(5).default(1),
  domainContext: z.enum(['technical', 'general', 'legal', 'medical', 'financial']).default('technical'),
});

export type HypotheticalDocGenerationRequest = z.input<typeof HypotheticalDocGenerationSchema>;

export const HyDESearchSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  numHypotheticalDocs: z.number().min(1).max(5).default(1),
  topKPerDoc: z.number().min(1).max(20).default(5),
  finalTopK: z.number().min(1).max(20).default(5),
  fusionStrategy: z.enum(['rrf', 'score_weighted', 'max_score']).default('rrf'),
  retrievalMode: z.enum(['vector_only', 'hybrid']).default('hybrid'),
  enableReranking: z.boolean().default(true),
  domainContext: z.enum(['technical', 'general', 'legal', 'medical', 'financial']).default('technical'),
  includeDirectQuerySearch: z.boolean().default(false),
});

export type HyDESearchRequest = z.input<typeof HyDESearchSchema>;

export const HyDERAGSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
  numHypotheticalDocs: z.number().min(1).max(5).default(1),
  topKPerDoc: z.number().min(1).max(20).default(5),
  finalTopK: z.number().min(1).max(20).default(5),
  fusionStrategy: z.enum(['rrf', 'score_weighted', 'max_score']).default('rrf'),
  retrievalMode: z.enum(['vector_only', 'hybrid']).default('hybrid'),
  enableReranking: z.boolean().default(true),
  domainContext: z.enum(['technical', 'general', 'legal', 'medical', 'financial']).default('technical'),
});

export type HyDERAGRequest = z.input<typeof HyDERAGSchema>;

export const GroundedAnswerSchema = z.object({
  answer: z.string().describe('Factually grounded answer synthesized strictly from real retrieved context chunks.'),
  confidenceScore: z.number().min(0).max(1).describe('Confidence score between 0 and 1 indicating alignment with context.'),
  citedChunkIds: z.array(z.string()).describe('List of chunk IDs cited as evidence in the answer.'),
  keyInsights: z.array(z.string()).describe('Bullet points highlighting core insights from the real context.'),
});

export type GroundedAnswerResponse = z.infer<typeof GroundedAnswerSchema>;
```

---

## ⚙️ Environment Configuration Loader

In [`src/config/environment.ts`](../code/src/config/environment.ts), environment settings are validated at startup:

```typescript
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const environmentSchema = z.object({
  PORT: z.string().transform((val) => parseInt(val, 10)).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_COMPLETION_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  DEFAULT_HYDE_NUM_DOCS: z.string().transform((val) => parseInt(val, 10)).default('1'),
  DEFAULT_HYDE_DOMAIN_CONTEXT: z.enum(['technical', 'general', 'legal', 'medical', 'financial']).default('technical'),
});

const parsed = environmentSchema.parse(process.env);

export const config = {
  port: parsed.PORT,
  nodeEnv: parsed.NODE_ENV,
  openaiApiKey: parsed.OPENAI_API_KEY,
  openaiCompletionModel: parsed.OPENAI_COMPLETION_MODEL,
  openaiEmbeddingModel: parsed.OPENAI_EMBEDDING_MODEL,
  defaultHyDENumDocs: parsed.DEFAULT_HYDE_NUM_DOCS,
  defaultDomainContext: parsed.DEFAULT_HYDE_DOMAIN_CONTEXT,
};
```

Next, proceed to **[Chapter 2 — Vector Store & Hybrid Retrieval Subsystem](./02-vector-store-and-hybrid-retrieval.md)**.
