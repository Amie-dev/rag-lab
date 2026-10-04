import { z } from 'zod';

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
 * Parents are NOT embedded/indexed for retrieval by default — they exist to
 * provide complete generation context once a matching child is found.
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
  parentId: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  tokenEstimate: number;
  metadata: DocumentMetadata;
  embedding?: number[];
}

/**
 * Tunables for the parent/child hierarchical chunker (sizes in characters).
 */
export interface ChunkingConfig {
  parentChunkSize: number;
  parentChunkOverlap: number;
  childChunkSize: number;
  childChunkOverlap: number;
}

/**
 * A single dense or sparse match over the CHILD index.
 */
export interface ChildSearchHit {
  child: ChildChunk;
  score: number;
  searchMethod: 'child_dense' | 'child_bm25';
  rank: number;
}

/**
 * A deduplicated, fused CHILD candidate produced from one or more retrieval passes.
 */
export interface MergedChildCandidate {
  child: ChildChunk;
  parentId: string;
  finalScore: number;
  rrfScore?: number;
  occurrences: number;
  retrievedByMethods: string[];
}

/**
 * A resolved PARENT context ready for injection into the generation LLM.
 * Aggregates the evidence from all matching children of a single parent.
 */
export interface ParentContext {
  parent: ParentChunk;
  resolvedFromChildIds: string[];
  contributingChildCount: number;
  bestChildScore: number;
  aggregateScore: number;
  rankScore: number;
  retrievedByMethods: string[];
  tokenEstimate: number;
}

export type FusionStrategy = 'rrf' | 'score_weighted' | 'max_score';
export type RetrievalMode = 'vector_only' | 'hybrid';
export type ContextScoreAggregation = 'best_child' | 'mean_child' | 'sum_child';

/**
 * Diagnostics describing how children were collapsed into parent contexts.
 */
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

// ---------------------------------------------------------------------------
// Zod schemas — API request contracts
// ---------------------------------------------------------------------------

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

export type IngestDocumentsRequest = z.input<typeof IngestDocumentsSchema>;

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

export const ParentDocumentRAGSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
  childTopK: z.number().int().min(1).max(50).default(12),
  finalChildTopK: z.number().int().min(1).max(50).default(8),
  maxParents: z.number().int().min(1).max(25).default(4),
  maxContextTokens: z.number().int().min(100).max(50000).default(3000),
  fusionStrategy: z.enum(['rrf', 'score_weighted', 'max_score']).default('rrf'),
  retrievalMode: z.enum(['vector_only', 'hybrid']).default('hybrid'),
  enableReranking: z.boolean().default(true),
  scoreAggregation: z.enum(['best_child', 'mean_child', 'sum_child']).default('mean_child'),
});

export type ParentDocumentRAGRequest = z.input<typeof ParentDocumentRAGSchema>;

export const BenchmarkRequestSchema = z.object({
  testQueries: z.array(z.string()).min(1).optional(),
  // Retrieval budget (top children) shared by every strategy under test. A small
  // budget models the realistic "top-few-chunks" behaviour of standard RAG and
  // makes the context-fragmentation difference explicit.
  childTopK: z.number().int().min(1).max(20).default(3),
  maxParents: z.number().int().min(1).max(10).default(4),
});

export type BenchmarkRequest = z.input<typeof BenchmarkRequestSchema>;

// ---------------------------------------------------------------------------
// Zod schema — structured grounded answer (OpenAI Structured Outputs)
// ---------------------------------------------------------------------------

export const GroundedAnswerSchema = z.object({
  answer: z.string().describe('Factually grounded answer synthesized strictly from the real parent context provided.'),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence 0..1 reflecting alignment between the answer and the supplied parent context.'),
  citedParentIds: z.array(z.string()).describe('Parent chunk IDs cited as evidence in the answer.'),
  keyInsights: z.array(z.string()).describe('Bullet points highlighting the core insights drawn from the parent context.'),
});

export type GroundedAnswerResponse = z.infer<typeof GroundedAnswerSchema>;

// ---------------------------------------------------------------------------
// Response contracts
// ---------------------------------------------------------------------------

export interface ParentDocumentSearchResponse {
  query: string;
  totalChildCandidatesRetrieved: number;
  uniqueChildrenDeduplicated: number;
  fusionStrategy: FusionStrategy;
  retrievalMode: RetrievalMode;
  childCandidates: MergedChildCandidate[];
  topChildCandidates: MergedChildCandidate[];
  resolution: ParentResolutionResult;
  executionTimeMs: number;
}

export interface ParentDocumentRAGResponse {
  question: string;
  answer: string;
  confidenceScore: number;
  citedParentIds: string[];
  keyInsights: string[];
  retrievalSummary: {
    totalChildCandidates: number;
    uniqueChildren: number;
    finalChildCandidates: number;
    parentContextsResolved: number;
    totalContextTokens: number;
    fusionStrategy: FusionStrategy;
    rerankingApplied: boolean;
    budgetExceeded: boolean;
  };
  childEvidence: MergedChildCandidate[];
  parentContexts: ParentContext[];
  executionTimeMs: number;
}

export interface IngestionStats {
  documentsIngested: number;
  parentsCreated: number;
  childrenCreated: number;
  totalParents: number;
  totalChildren: number;
}

export interface BenchmarkMetrics {
  pipelineType: 'Standard RAG (Child-Only)' | 'Parent-Document RAG' | 'Parent-Document RAG + Reranker';
  latencyMs: number;
  childrenRetrieved: number;
  parentContextsResolved: number;
  avgRetrievalScore: number;
  contextTokens: number;
  contextCompletenessScore: number;
  answerConfidence: number;
}

export interface BenchmarkResponse {
  totalQueriesEvaluated: number;
  metricsPerStrategy: Record<string, BenchmarkMetrics>;
  summary: {
    recommendedStrategy: string;
    contextCompletenessGainPct: number;
    averageLatencyMs: Record<string, number>;
  };
}
