/**
 * Domain Schemas and Type Definitions for Vector RAG Engine
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

export type SimilarityMetric = 'cosine' | 'dot_product' | 'euclidean' | 'manhattan';

export type IndexType = 'flat' | 'hnsw' | 'ivf';

export type FilterOperator =
  | '$eq'
  | '$ne'
  | '$gt'
  | '$gte'
  | '$lt'
  | '$lte'
  | '$in'
  | '$nin';

export type MetadataValue = string | number | boolean | Array<string | number>;

export interface ConditionFilter {
  [operator: string]: MetadataValue;
}

export type FieldFilter = MetadataValue | ConditionFilter;

export interface MetadataFilter {
  $and?: MetadataFilter[];
  $or?: MetadataFilter[];
  [field: string]: FieldFilter | MetadataFilter[] | undefined;
}

export interface RetrievalResult {
  chunk: Chunk;
  score: number;
  distance: number;
  metric: SimilarityMetric;
  recordId: string;
}

export interface RAGResponse {
  question: string;
  answer: string;
  contextChunks: RetrievalResult[];
  metadata: {
    model: string;
    indexType: IndexType;
    similarityMetric: SimilarityMetric;
    totalTokensUsed?: number;
    retrievalLatencyMs?: number;
    generationLatencyMs?: number;
    totalLatencyMs?: number;
  };
}

export interface HNSWConfig {
  M?: number;              // Max connections per node per layer (e.g., 16)
  efConstruction?: number; // Size of dynamic candidate list during index construction (e.g., 64)
  efSearch?: number;       // Size of dynamic candidate list during query search (e.g., 32)
  maxLevel?: number;       // Maximum allowed level hierarchy depth
}

export interface IVFConfig {
  numLists?: number;       // Number of centroids/clusters (e.g., 10)
  nprobe?: number;         // Number of inverted lists to probe during search (e.g., 3)
  kmeansIterations?: number;// Max iterations for centroid clustering
}

export interface IndexConfig {
  type: IndexType;
  hnsw?: HNSWConfig;
  ivf?: IVFConfig;
}

export interface BenchmarkResult {
  indexType: IndexType;
  totalRecords: number;
  dimension: number;
  indexingTimeMs: number;
  searchLatencyMs: number;
  recallAtK: number;       // Accuracy relative to exact Flat brute-force search
  avgSimilarityScore: number;
}
