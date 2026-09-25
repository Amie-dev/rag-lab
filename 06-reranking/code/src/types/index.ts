import { z } from 'zod';

/**
 * Metadata associated with a document chunk.
 */
export interface DocumentMetadata {
  title: string;
  category?: string;
  source?: string;
  tags?: string[];
  author?: string;
  created_at?: string;
  [key: string]: any;
}

/**
 * Core Document Chunk representation in the Vector DB / Retriever.
 */
export interface DocumentChunk {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  embedding?: number[];
}

/**
 * Result from Stage 1 Candidate Retrieval.
 */
export interface CandidateResult {
  chunk: DocumentChunk;
  stage1Score: number;
  stage1Rank: number;
  retrievalMethod: 'dense' | 'sparse' | 'hybrid';
}

/**
 * Result from Stage 2 Reranking.
 */
export interface RerankedResult {
  chunk: DocumentChunk;
  stage1Score: number;
  stage1Rank: number;
  stage2Score: number;
  finalRank: number;
  rankDelta: number; // stage1Rank - finalRank (+ means moved up)
  reasoning?: string;
  retrievalMethod?: RetrievalMode;
}

/**
 * Retrieval Mode Options
 */
export type RetrievalMode = 'dense' | 'sparse' | 'hybrid';

/**
 * Reranker Model Provider Options
 */
export type RerankerProvider = 'cross-encoder' | 'openai-structured' | 'cohere' | 'local';

/**
 * Configuration options for the two-stage retrieval pipeline.
 */
export interface PipelineOptions {
  stage1CandidateTopN: number;
  stage2FinalTopK: number;
  retrievalMode: RetrievalMode;
  rerankerProvider: RerankerProvider;
  hybridAlpha?: number; // 0.0 = sparse, 1.0 = dense
}

/**
 * Provenance and Metrics for a RAG execution.
 */
export interface PipelineMetrics {
  stage1LatencyMs: number;
  stage2LatencyMs: number;
  totalLatencyMs: number;
  candidateCount: number;
  finalCount: number;
  topRankShift: boolean; // True if #1 candidate changed after reranking
}

/**
 * Full Pipeline Execution Output
 */
export interface PipelineExecutionResult {
  query: string;
  options: PipelineOptions;
  candidates: CandidateResult[];
  rerankedResults: RerankedResult[];
  metrics: PipelineMetrics;
}

/**
 * OpenAI Structured Output Schemas for Cross-Encoder Reranking
 */
export const RerankScoreSchema = z.object({
  chunkId: z.string().describe("The unique identifier of the document chunk"),
  relevanceScore: z.number().min(0).max(1).describe("Relevance score from 0.0 (completely irrelevant) to 1.0 (highly relevant)"),
  reasoning: z.string().describe("Brief explanation of why this document is or isn't relevant to the query")
});

export const RerankBatchResponseSchema = z.object({
  rankings: z.array(RerankScoreSchema).describe("List of candidate documents evaluated against the query")
});

export type RerankBatchResponse = z.infer<typeof RerankBatchResponseSchema>;

/**
 * OpenAI Structured Output Schema for Grounded RAG Generation
 */
export const RAGAnswerSchema = z.object({
  answer: z.string().describe("Direct, comprehensive answer grounded exclusively in the provided context chunks"),
  confidenceScore: z.number().min(0).max(1).describe("Confidence score based on context alignment"),
  citedChunkIds: z.array(z.string()).describe("IDs of chunks directly referenced to formulate the answer"),
  keyInsights: z.array(z.string()).describe("Key takeaways or facts extracted from the context")
});

export type RAGAnswerResponse = z.infer<typeof RAGAnswerSchema>;

/**
 * Zod Validation Schemas for REST APIs
 */
export const IngestDocumentSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1, "Document content cannot be empty"),
  metadata: z.object({
    title: z.string().min(1, "Title is required"),
    category: z.string().optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional()
  }).passthrough()
});

export const SearchQuerySchema = z.object({
  query: z.string().min(1, "Query string is required"),
  stage1CandidateTopN: z.number().int().min(1).max(200).default(20),
  stage2FinalTopK: z.number().int().min(1).max(50).default(5),
  retrievalMode: z.enum(['dense', 'sparse', 'hybrid']).default('hybrid'),
  rerankerProvider: z.enum(['cross-encoder', 'openai-structured', 'cohere', 'local']).default('local'),
  hybridAlpha: z.number().min(0).max(1).default(0.5)
});

export const DirectRerankSchema = z.object({
  query: z.string().min(1, "Query is required"),
  documents: z.array(z.object({
    id: z.string(),
    content: z.string(),
    metadata: z.object({
      title: z.string().optional()
    }).passthrough().optional()
  })).min(1, "At least one document is required"),
  topK: z.number().int().min(1).default(5)
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
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either query or question field must be provided',
    });
    return z.NEVER;
  }
  return {
    ...data,
    query: queryStr,
  };
});

export const BenchmarkRequestSchema = z.object({
  queries: z.array(z.string()).min(1, "At least one query required").optional(),
  candidateSizes: z.array(z.number().int().min(2)).default([5, 10, 20, 50]),
  topK: z.number().int().min(1).default(5),
  retrievalMode: z.enum(['dense', 'sparse', 'hybrid']).default('hybrid')
});
