/**
 * Domain Schemas and Type Definitions for Hybrid RAG Engine
 */

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

export interface VectorRecord {
  id: string;
  vector: number[];
  chunk: Chunk;
  metadata: ChunkMetadata;
}

export type SimilarityMetric = 'cosine' | 'dot_product' | 'euclidean';

export interface DenseRetrievalResult {
  recordId: string;
  chunk: Chunk;
  score: number;       // Cosine similarity score [0..1]
  distance: number;    // Distance metric
  metric: SimilarityMetric;
  rank: number;        // 1-indexed rank position in dense list
}

export interface SparseRetrievalResult {
  docId: string;
  chunk: Chunk;
  score: number;       // BM25 raw score
  matchedTerms: string[];
  rank: number;        // 1-indexed rank position in sparse list
}

export type FusionStrategy = 'rrf' | 'weighted_score' | 'weighted_rrf';

export type ScoreNormalizerType = 'minmax' | 'zscore' | 'softmax' | 'none';

export interface FusionExplanation {
  chunkId: string;
  documentId: string;
  denseRank: number | null;
  denseRawScore: number | null;
  denseNormalizedScore: number | null;
  denseRrfContribution: number | null;

  sparseRank: number | null;
  sparseRawScore: number | null;
  sparseNormalizedScore: number | null;
  sparseRrfContribution: number | null;

  finalHybridScore: number;
  finalRank: number;
  strategyUsed: FusionStrategy;
  mathematicalFormula: string;
}

export interface HybridRetrievalResult {
  chunk: Chunk;
  finalScore: number;
  finalRank: number;
  denseResult?: DenseRetrievalResult;
  sparseResult?: SparseRetrievalResult;
  explanation: FusionExplanation;
}

export interface HybridConfig {
  topK?: number;             // Final top-K results to return (default: 5)
  denseTopK?: number;        // Number of candidates retrieved from Dense index (default: 20)
  sparseTopK?: number;       // Number of candidates retrieved from Sparse index (default: 20)
  fusionStrategy?: FusionStrategy; // Strategy: 'rrf' | 'weighted_score' | 'weighted_rrf' (default: 'rrf')
  rrfK?: number;             // Smoothing constant k for RRF (default: 60)
  alpha?: number;            // Weight for dense search in weighted fusion [0..1] (default: 0.5)
  normalizerType?: ScoreNormalizerType; // Score normalizer algorithm for weighted score fusion (default: 'minmax')
}

export interface RAGResponse {
  question: string;
  answer: string;
  contextChunks: HybridRetrievalResult[];
  metadata: {
    model: string;
    fusionStrategy: FusionStrategy;
    rrfK: number;
    alpha: number;
    denseCandidateCount: number;
    sparseCandidateCount: number;
    totalChunksIndexed: number;
    retrievalLatencyMs?: number;
    generationLatencyMs?: number;
    totalLatencyMs?: number;
  };
}

export interface RankCorrelationResult {
  kendallTau: number;
  spearmanRho: number;
  commonItemCount: number;
  jaccardSimilarity: number;
}

export interface BenchmarkMetrics {
  retrievalLatencyMs: number;
  candidateCount: number;
  topItemIds: string[];
  overlapWithHybridPercent?: number;
}

export interface ComparativeBenchmarkResult {
  query: string;
  denseMetrics: BenchmarkMetrics;
  sparseMetrics: BenchmarkMetrics;
  hybridMetrics: BenchmarkMetrics;
  rankCorrelation: RankCorrelationResult;
}
