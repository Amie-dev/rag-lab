import { z } from 'zod';

/**
 * Metadata associated with a document chunk
 */
export interface DocumentMetadata {
  title?: string;
  category?: string;
  source?: string;
  author?: string;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Document chunk stored in Vector DB / Search Index
 */
export interface DocumentChunk {
  id: string;
  content: string;
  embedding?: number[];
  metadata: DocumentMetadata;
}

/**
 * Input request for document ingestion
 */
export const IngestDocumentSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1, 'Content cannot be empty'),
  metadata: z.record(z.unknown()).optional().default({}),
});

export type IngestDocumentInput = z.infer<typeof IngestDocumentSchema>;

/**
 * Generated query variation with intent perspective
 */
export interface QueryVariation {
  queryId: string;
  text: string;
  perspective?: string;
}

/**
 * OpenAI Structured Output Schema for Query Generation
 */
export const MultiQueryGenResponseSchema = z.object({
  queries: z.array(z.string()).min(1, 'At least 1 query variation required'),
  reasoning: z.string().optional(),
});

export type MultiQueryGenResponse = z.infer<typeof MultiQueryGenResponseSchema>;

/**
 * Single retrieval result item
 */
export interface ScoredChunk {
  chunk: DocumentChunk;
  score: number;
  retrievalType?: 'vector' | 'bm25' | 'hybrid';
}

/**
 * Retrieval results per single generated query
 */
export interface SingleQueryRetrievalResult {
  query: string;
  queryId: string;
  results: ScoredChunk[];
}

/**
 * Fusion strategy options
 */
export type FusionStrategy = 'rrf' | 'max_score' | 'avg_score';

/**
 * Deduplicated merged candidate document chunk
 */
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

/**
 * Multi-Query Search Request Schema
 */
export const MultiQuerySearchRequestSchema = z.object({
  query: z.string().min(1, 'Original query cannot be empty'),
  numQueries: z.number().int().min(1).max(10).optional().default(4),
  topKPerQuery: z.number().int().min(1).max(50).optional().default(5),
  finalTopK: z.number().int().min(1).max(50).optional().default(5),
  fusionStrategy: z.enum(['rrf', 'max_score', 'avg_score']).optional().default('rrf'),
  enableReranking: z.boolean().optional().default(true),
  retrievalMode: z.enum(['vector', 'bm25', 'hybrid']).optional().default('hybrid'),
});

export type MultiQuerySearchRequest = z.input<typeof MultiQuerySearchRequestSchema>;

/**
 * Multi-Query Search Response
 */
export interface MultiQuerySearchResponse {
  originalQuery: string;
  generatedQueries: QueryVariation[];
  totalCandidatesRetrieved: number;
  uniqueCandidatesDeduplicated: number;
  fusionStrategy: FusionStrategy;
  mergedResults: MergedCandidateChunk[];
  topContextChunks: MergedCandidateChunk[];
}

/**
 * OpenAI Structured Output Schema for Grounded RAG Answer Generation
 */
export const RAGAnswerSchema = z.object({
  answer: z.string(),
  confidenceScore: z.number().min(0).max(1),
  citedChunkIds: z.array(z.string()),
  keyInsights: z.array(z.string()),
});

export type RAGAnswerResponse = z.infer<typeof RAGAnswerSchema>;

/**
 * End-to-End Multi-Query RAG Request Schema
 */
export const MultiQueryRAGRequestSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
  numQueries: z.number().int().min(1).max(10).optional().default(4),
  topKPerQuery: z.number().int().min(1).max(50).optional().default(5),
  finalTopK: z.number().int().min(1).max(50).optional().default(5),
  fusionStrategy: z.enum(['rrf', 'max_score', 'avg_score']).optional().default('rrf'),
  enableReranking: z.boolean().optional().default(true),
  retrievalMode: z.enum(['vector', 'bm25', 'hybrid']).optional().default('hybrid'),
});

export type MultiQueryRAGRequest = z.input<typeof MultiQueryRAGRequestSchema>;

/**
 * End-to-End Multi-Query RAG Response
 */
export interface MultiQueryRAGResponse {
  question: string;
  generatedQueries: QueryVariation[];
  answer: string;
  confidenceScore: number;
  citedChunkIds: string[];
  keyInsights: string[];
  retrievalSummary: {
    totalRetrieved: number;
    uniqueDeduplicated: number;
    finalContextCount: number;
    fusionStrategy: FusionStrategy;
  };
  retrievedContext: MergedCandidateChunk[];
}

/**
 * Benchmark Comparison Request Schema
 */
export const BenchmarkRequestSchema = z.object({
  queries: z.array(z.string()).optional(),
  numQueries: z.number().int().min(2).max(8).optional().default(4),
  topKPerQuery: z.number().int().min(1).max(20).optional().default(5),
  finalTopK: z.number().int().min(1).max(10).optional().default(5),
});

export type BenchmarkRequest = z.input<typeof BenchmarkRequestSchema>;

/**
 * Benchmark comparison metrics between Single-Query and Multi-Query RAG
 */
export interface BenchmarkComparisonResult {
  query: string;
  singleQueryMetrics: {
    queryUsed: string;
    chunksRetrieved: number;
    uniqueChunkIds: string[];
    latencyMs: number;
  };
  multiQueryMetrics: {
    generatedQueries: string[];
    totalRetrieved: number;
    uniqueChunkIds: string[];
    uniqueChunkCount: number;
    newChunksDiscovered: number; // Chunks found in MQ but missed in Single Query
    recallGainPercent: number;
    deduplicationRatio: number;
    latencyMs: number;
  };
}

export interface BenchmarkSummaryResponse {
  testQueriesCount: number;
  results: BenchmarkComparisonResult[];
  averageMetrics: {
    avgSingleQueryChunks: number;
    avgMultiQueryUniqueChunks: number;
    avgNewChunksDiscovered: number;
    avgRecallGainPercent: number;
    avgDeduplicationRatio: number;
    avgSingleQueryLatencyMs: number;
    avgMultiQueryLatencyMs: number;
  };
}
