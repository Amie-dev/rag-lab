/**
 * Domain Schemas and Data Models for Basic RAG Engine
 */

export interface DocumentMetadata {
  source: string;
  filename?: string;
  fileType?: string;
  createdAt?: string;
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

export interface RetrievalResult {
  chunk: Chunk;
  score: number;
  metric: SimilarityMetric;
}

export interface RAGResponse {
  question: string;
  answer: string;
  contextChunks: RetrievalResult[];
  metadata: {
    model: string;
    totalTokensUsed?: number;
    retrievalLatencyMs?: number;
    generationLatencyMs?: number;
    totalLatencyMs?: number;
  };
}
