/**
 * Domain Schemas and Type Definitions for Keyword / Sparse RAG Engine
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

export interface Token {
  term: string;
  rawTerm: string;
}

export interface PositionedToken extends Token {
  position: number;
  startOffset: number;
  endOffset: number;
}

export interface Posting {
  docId: string;
  termFrequency: number;
  positions: number[];
  termOffsets?: Array<{ start: number; end: number }>;
}

export interface InvertedIndexStats {
  totalDocuments: number;
  totalTerms: number;
  vocabularySize: number;
  avgDocLength: number;
  docLengths: Record<string, number>;
}

export interface SerializedPosting {
  docId: string;
  termFrequency: number;
  positions: number[];
  termOffsets?: Array<{ start: number; end: number }>;
}

export interface SerializedInvertedIndex {
  version: string;
  stats: InvertedIndexStats;
  postings: Record<string, SerializedPosting[]>;
  docFrequency: Record<string, number>;
  collectionTermFrequency: Record<string, number>;
  chunks: Record<string, Chunk>;
}

export type AnalyzerType = 'standard' | 'technical' | 'simple';
export type ScoringAlgorithm = 'bm25' | 'tfidf';

export interface BM25Params {
  k1: number;       // Term frequency saturation parameter (default: 1.5)
  b: number;        // Document length normalization parameter (default: 0.75)
  epsilon?: number; // IDF floor constant to avoid negative scores for frequent terms (default: 0.25)
}

export interface TFIDFParams {
  smoothIdf?: boolean;   // Add 1 to document frequencies (default: true)
  sublinearTf?: boolean; // Use 1 + log(tf) scaling (default: true)
}

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

export interface TermScoreDetail {
  term: string;
  rawTf: number;
  idf: number;
  bm25Score: number;
  tfidfScore: number;
  scoreContribution: number;
}

export interface ScoreExplanation {
  chunkId: string;
  documentId: string;
  finalScore: number;
  algorithm: ScoringAlgorithm;
  termDetails: TermScoreDetail[];
  documentLength: number;
  avgDocumentLength: number;
}

export interface KeywordRetrievalResult {
  chunk: Chunk;
  score: number;
  bm25Score: number;
  tfidfScore: number;
  matchedTerms: string[];
  explanation?: ScoreExplanation;
}

export interface SearchQuery {
  query: string;
  topK?: number;
  algorithm?: ScoringAlgorithm;
  analyzerType?: AnalyzerType;
  filter?: MetadataFilter;
  bm25Params?: BM25Params;
  tfidfParams?: TFIDFParams;
  explain?: boolean;
}

export interface RAGResponse {
  question: string;
  answer: string;
  contextChunks: KeywordRetrievalResult[];
  metadata: {
    model: string;
    algorithm: ScoringAlgorithm;
    analyzerType: AnalyzerType;
    totalChunksIndexed: number;
    retrievalLatencyMs?: number;
    generationLatencyMs?: number;
    totalLatencyMs?: number;
  };
}
