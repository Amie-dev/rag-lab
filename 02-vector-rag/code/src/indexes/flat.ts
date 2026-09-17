import { IndexSearchResult, VectorIndex } from './base';
import { SimilarityMetric, VectorRecord } from '../schemas';
import { VectorMath } from '../math/vectorMath';

/**
 * Flat (Brute Force) Vector Index.
 * Computes exact distances against all stored records.
 * Serves as the ground-truth benchmark baseline (100% Recall).
 */
export class FlatIndex implements VectorIndex {
  private records: Map<string, VectorRecord> = new Map();

  public async insert(record: VectorRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  public async insertBatch(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

  public async search(
    queryVector: number[],
    topK: number,
    metric: SimilarityMetric = 'cosine',
    filterFn?: (record: VectorRecord) => boolean
  ): Promise<IndexSearchResult[]> {
    const results: IndexSearchResult[] = [];

    for (const record of this.records.values()) {
      if (filterFn && !filterFn(record)) {
        continue;
      }

      const rawDist = VectorMath.computeDistance(queryVector, record.vector, metric);
      let score: number;

      if (metric === 'cosine') {
        const rawSim = VectorMath.cosineSimilarity(queryVector, record.vector);
        score = VectorMath.distanceToScore(rawSim, 'cosine');
      } else if (metric === 'dot_product') {
        const dot = VectorMath.dotProduct(queryVector, record.vector);
        score = VectorMath.distanceToScore(dot, 'dot_product');
      } else {
        score = VectorMath.distanceToScore(rawDist, metric);
      }

      results.push({
        record,
        distance: rawDist,
        score,
      });
    }

    // Sort by score descending (higher similarity is better)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  public async remove(id: string): Promise<boolean> {
    return this.records.delete(id);
  }

  public async clear(): Promise<void> {
    this.records.clear();
  }

  public count(): number {
    return this.records.size;
  }
}
