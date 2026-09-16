import { Chunk, VectorRecord, RetrievalResult, SimilarityMetric } from '../schemas';

export interface VectorStore {
  /**
   * Add chunk vector records into the vector database.
   */
  add(records: VectorRecord[]): Promise<void>;

  /**
   * Search top-K similar chunks for a given query vector.
   */
  search(
    queryVector: number[],
    topK: number,
    metric?: SimilarityMetric,
    filter?: (chunk: Chunk) => boolean
  ): Promise<RetrievalResult[]>;

  /**
   * Clear all records in the vector store.
   */
  clear(): Promise<void>;

  /**
   * Count total stored records.
   */
  count(): Promise<number>;
}
