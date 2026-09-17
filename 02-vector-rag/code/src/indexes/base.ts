import { SimilarityMetric, VectorRecord } from '../schemas';

export interface IndexSearchResult {
  record: VectorRecord;
  distance: number;
  score: number;
}

export interface VectorIndex {
  /**
   * Insert a vector record into the index.
   */
  insert(record: VectorRecord): Promise<void>;

  /**
   * Insert multiple records in bulk.
   */
  insertBatch(records: VectorRecord[]): Promise<void>;

  /**
   * Search top-K nearest vectors for query vector.
   * Optionally filter records prior to ranking.
   */
  search(
    queryVector: number[],
    topK: number,
    metric: SimilarityMetric,
    filterFn?: (record: VectorRecord) => boolean
  ): Promise<IndexSearchResult[]>;

  /**
   * Remove a record by ID.
   */
  remove(id: string): Promise<boolean>;

  /**
   * Clear index.
   */
  clear(): Promise<void>;

  /**
   * Total number of indexed records.
   */
  count(): number;
}
