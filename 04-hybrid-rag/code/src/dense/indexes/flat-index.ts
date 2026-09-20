import { VectorRecord, SimilarityMetric, DenseRetrievalResult } from '../../schemas';
import { computeDistance } from '../metrics';

export interface VectorIndex {
  add(record: VectorRecord): void;
  addBatch(records: VectorRecord[]): void;
  search(queryVector: number[], topK: number): DenseRetrievalResult[];
  clear(): void;
  size(): number;
}

export class FlatVectorIndex implements VectorIndex {
  private records: VectorRecord[] = [];
  private metric: SimilarityMetric;

  constructor(metric: SimilarityMetric = 'cosine') {
    this.metric = metric;
  }

  add(record: VectorRecord): void {
    this.records.push(record);
  }

  addBatch(records: VectorRecord[]): void {
    this.records.push(...records);
  }

  search(queryVector: number[], topK: number): DenseRetrievalResult[] {
    const scored = this.records.map((record) => {
      const { score, distance } = computeDistance(queryVector, record.vector, this.metric);
      return {
        recordId: record.id,
        chunk: record.chunk,
        score,
        distance,
        metric: this.metric,
        rank: 0 // Will be set after sorting
      };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    const results = scored.slice(0, topK);
    results.forEach((item, index) => {
      item.rank = index + 1;
    });

    return results;
  }

  clear(): void {
    this.records = [];
  }

  size(): number {
    return this.records.length;
  }
}
