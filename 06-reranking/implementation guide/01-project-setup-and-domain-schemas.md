# 🛠️ Chapter 1 — Project Setup & Domain Schemas

Welcome to Chapter 1 of the **Reranking RAG Implementation Guide**. In this chapter, we initialize the project structure, configure `package.json` and `tsconfig.json`, and define the core domain interfaces, data transfer objects (DTOs), and Zod validation schemas.

All corresponding code is located in [`06-reranking/code`](../code).

---

## 1. Project Dependencies & Configuration

We configure a modern TypeScript environment with Express, Zod, Commander, and the official OpenAI SDK supporting Structured Outputs.

### `package.json`
```json
{
  "name": "@rag-lab/reranking-rag",
  "version": "1.0.0",
  "dependencies": {
    "commander": "^12.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "openai": "^4.55.0",
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

---

## 2. Core Domain Data Types (`src/types/index.ts`)

```typescript
import { z } from 'zod';

export interface DocumentMetadata {
  title: string;
  category?: string;
  source?: string;
  tags?: string[];
  [key: string]: any;
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  embedding?: number[];
}

export interface CandidateResult {
  chunk: DocumentChunk;
  stage1Score: number;
  stage1Rank: number;
  retrievalMethod: 'dense' | 'sparse' | 'hybrid';
}

export interface RerankedResult {
  chunk: DocumentChunk;
  stage1Score: number;
  stage1Rank: number;
  stage2Score: number;
  finalRank: number;
  rankDelta: number; // stage1Rank - finalRank (+ means moved up)
  reasoning?: string;
  retrievalMethod?: 'dense' | 'sparse' | 'hybrid';
}

export type RetrievalMode = 'dense' | 'sparse' | 'hybrid';
export type RerankerProvider = 'cross-encoder' | 'openai-structured' | 'cohere' | 'local';

export interface PipelineOptions {
  stage1CandidateTopN: number;
  stage2FinalTopK: number;
  retrievalMode: RetrievalMode;
  rerankerProvider: RerankerProvider;
  hybridAlpha?: number;
}
```

---

## 3. OpenAI SDK Structured Output Schemas

We define strict Zod schemas for OpenAI Structured Outputs (`beta.chat.completions.parse`):

### 3.1 Cross-Encoder Reranking Schema
```typescript
export const RerankScoreSchema = z.object({
  chunkId: z.string().describe("The unique identifier of the document chunk"),
  relevanceScore: z.number().min(0).max(1).describe("Relevance score from 0.0 to 1.0"),
  reasoning: z.string().describe("Brief explanation of relevance")
});

export const RerankBatchResponseSchema = z.object({
  rankings: z.array(RerankScoreSchema).describe("List of candidate documents evaluated against the query")
});

export type RerankBatchResponse = z.infer<typeof RerankBatchResponseSchema>;
```

### 3.2 Grounded RAG Answer Schema
```typescript
export const RAGAnswerSchema = z.object({
  answer: z.string().describe("Direct, comprehensive answer grounded exclusively in provided context chunks"),
  confidenceScore: z.number().min(0).max(1).describe("Confidence score based on context alignment"),
  citedChunkIds: z.array(z.string()).describe("IDs of chunks directly referenced"),
  keyInsights: z.array(z.string()).describe("Key takeaways extracted from context")
});

export type RAGAnswerResponse = z.infer<typeof RAGAnswerSchema>;
```

---

## 4. API Request Validation Schemas

```typescript
export const SearchQuerySchema = z.object({
  query: z.string().min(1, "Query string is required"),
  stage1CandidateTopN: z.number().int().min(1).max(200).default(20),
  stage2FinalTopK: z.number().int().min(1).max(50).default(5),
  retrievalMode: z.enum(['dense', 'sparse', 'hybrid']).default('hybrid'),
  rerankerProvider: z.enum(['cross-encoder', 'openai-structured', 'cohere', 'local']).default('local'),
  hybridAlpha: z.number().min(0).max(1).default(0.5)
});

export const RAGQuerySchema = z.object({
  query: z.string().optional(),
  question: z.string().optional(),
  stage1CandidateTopN: z.number().int().min(1).max(200).default(20),
  stage2FinalTopK: z.number().int().min(1).max(50).default(5),
  retrievalMode: z.enum(['dense', 'sparse', 'hybrid']).default('hybrid'),
  rerankerProvider: z.enum(['cross-encoder', 'openai-structured', 'cohere', 'local']).default('local'),
  hybridAlpha: z.number().min(0).max(1).default(0.5)
}).transform((data, ctx) => {
  const queryStr = data.query || data.question;
  if (!queryStr) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Either query or question must be provided' });
    return z.NEVER;
  }
  return { ...data, query: queryStr };
});
```

In Chapter 2, we build the Stage 1 Candidate Retrieval Subsystem.
