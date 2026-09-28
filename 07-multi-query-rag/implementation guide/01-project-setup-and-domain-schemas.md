# Chapter 1 — Project Setup & Domain Schemas

## 🛠️ Project Environment Setup

The Multi-Query RAG project is built with **TypeScript**, **Express**, **Zod**, and the **OpenAI SDK**.

### Directory Structure

```text
07-multi-query-rag/
├── README.md
├── implementation guide/
│   ├── README.md
│   ├── 00-introduction-and-multi-query-theory.md
│   └── ...
└── code/
    ├── package.json
    ├── tsconfig.json
    ├── jest.config.js
    ├── .env.example
    ├── sample_data/
    │   └── documents.json
    ├── src/
    │   ├── types/
    │   │   └── index.ts
    │   ├── config/
    │   │   └── environment.ts
    │   ├── services/
    │   │   ├── embedding.service.ts
    │   │   ├── bm25.service.ts
    │   │   ├── vector-store.service.ts
    │   │   ├── multi-query-generator.service.ts
    │   │   ├── result-merger.service.ts
    │   │   ├── reranker.service.ts
    │   │   ├── llm.service.ts
    │   │   ├── multi-query-rag.service.ts
    │   │   └── benchmark.service.ts
    │   ├── controllers/
    │   ├── routes/
    │   ├── app.ts
    │   ├── server.ts
    │   └── cli.ts
    └── tests/
```

---

## 📐 Core Domain Schemas & DTOs

Located in [`code/src/types/index.ts`](../code/src/types/index.ts):

### 1. Document Chunk Interface
```typescript
export interface DocumentMetadata {
  title?: string;
  category?: string;
  source?: string;
  author?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface DocumentChunk {
  id: string;
  content: string;
  embedding?: number[];
  metadata: DocumentMetadata;
}
```

### 2. Query Variation
```typescript
export interface QueryVariation {
  queryId: string;
  text: string;
  perspective?: string;
}
```

### 3. Merged Candidate Chunk with Query Attribution
```typescript
export interface MergedCandidateChunk {
  chunk: DocumentChunk;
  occurrences: number;
  retrievedByQueries: string[];
  scoresPerQuery: Record<string, number>;
  ranksPerQuery: Record<string, number>;
  maxScore: number;
  avgScore: number;
  rrfScore: number;
  finalScore: number;
}
```

### 4. Zod Request Validation Schemas
```typescript
export const MultiQuerySearchRequestSchema = z.object({
  query: z.string().min(1, 'Original query cannot be empty'),
  numQueries: z.number().int().min(1).max(10).optional().default(4),
  topKPerQuery: z.number().int().min(1).max(50).optional().default(5),
  finalTopK: z.number().int().min(1).max(50).optional().default(5),
  fusionStrategy: z.enum(['rrf', 'max_score', 'avg_score']).optional().default('rrf'),
  enableReranking: z.boolean().optional().default(true),
  retrievalMode: z.enum(['vector', 'bm25', 'hybrid']).optional().default('hybrid'),
});
```

In the next chapter, we will examine the Vector Store, Embedding Service, and BM25 Sparse Search engines.
