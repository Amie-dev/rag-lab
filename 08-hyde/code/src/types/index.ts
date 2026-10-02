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

// Zod Schemas for API Requests & Structured LLM Responses
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

export interface HyDESearchResponse {
  originalQuery: string;
  hypotheticalDocuments: HypotheticalDocument[];
  totalCandidatesRetrieved: number;
  uniqueCandidatesDeduplicated: number;
  fusionStrategy: FusionStrategy;
  mergedCandidates: MergedCandidateChunk[];
  topContextChunks: MergedCandidateChunk[];
  executionTimeMs: number;
}

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

export interface HyDERAGResponse {
  question: string;
  hypotheticalDocuments: HypotheticalDocument[];
  answer: string;
  confidenceScore: number;
  citedChunkIds: string[];
  keyInsights: string[];
  retrievalSummary: {
    totalRetrieved: number;
    uniqueDeduplicated: number;
    finalContextCount: number;
    fusionStrategy: FusionStrategy;
    rerankingApplied: boolean;
  };
  retrievedContext: MergedCandidateChunk[];
  executionTimeMs: number;
}

export interface BenchmarkMetrics {
  pipelineType: 'Direct Vector RAG' | 'Single HyDE RAG' | 'Multi-HyDE RAG' | 'HyDE + Reranker RAG';
  latencyMs: number;
  candidatesRetrieved: number;
  uniqueDeduplicated: number;
  avgSimilarityScore: number;
  topRetrievedChunkTitles: string[];
  representationGapScore: number; // Cosine distance between query & document vs hypothetical & document
  answerConfidence: number;
}

export const BenchmarkRequestSchema = z.object({
  testQueries: z.array(z.string()).min(1).optional(),
  topK: z.number().min(1).max(10).default(5),
});

export type BenchmarkRequest = z.input<typeof BenchmarkRequestSchema>;

export interface BenchmarkResponse {
  totalQueriesEvaluated: number;
  metricsPerStrategy: Record<string, BenchmarkMetrics>;
  summary: {
    recommendedStrategy: string;
    representationGapReductionPct: number;
    averageLatencyMs: Record<string, number>;
  };
}
