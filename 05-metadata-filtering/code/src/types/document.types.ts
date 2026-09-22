/**
 * Document and Chunk Domain Schema Definitions
 */

export interface DocumentMetadata {
  tenant_id: string;
  user_id?: string;
  department?: string;
  created_at?: string; // ISO 8601 string, e.g. "2026-08-15"
  file_type?: string;  // e.g. "pdf", "docx", "txt", "md"
  document_type?: string; // e.g. "policy", "report", "specification"
  language?: string;   // e.g. "en", "es", "fr"
  access_level?: number; // e.g. 1 (public), 2 (employee), 3 (manager), 4 (exec)
  project_id?: string;
  source?: string;
  is_public?: boolean;
  [key: string]: unknown;
}

export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

export interface ChunkMetadata extends DocumentMetadata {
  document_id: string;
  chunk_index: number;
  total_chunks?: number;
  start_char?: number;
  end_char?: number;
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
