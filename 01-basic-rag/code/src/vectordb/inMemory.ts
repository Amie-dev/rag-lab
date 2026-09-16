import { VectorStore } from './base';
import { Chunk, VectorRecord, RetrievalResult, SimilarityMetric } from '../schemas';

export class InMemoryVectorStore implements VectorStore {
  private records: VectorRecord[] = [];

  async add(records: VectorRecord[]): Promise<void> {
    this.records.push(...records);
  }

  async search(
    queryVector: number[],
    topK: number,
    metric: SimilarityMetric = 'cosine',
    filter?: (chunk: Chunk) => boolean
  ): Promise<RetrievalResult[]> {
    if (this.records.length === 0) {
      return [];
    }

    let candidates = this.records;
    if (filter) {
      candidates = candidates.filter((r) => filter(r.chunk));
    }

    const scored = candidates.map((rec) => {
      const score = this.calculateSimilarity(queryVector, rec.vector, metric);
      return {
        chunk: rec.chunk,
        score,
        metric,
      };
    });

    // For cosine & dot_product higher is better; for Euclidean smaller distance is converted to higher similarity score
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK);
  }

  async clear(): Promise<void> {
    this.records = [];
  }

  async count(): Promise<number> {
    return this.records.length;
  }

  private calculateSimilarity(a: number[], b: number[], metric: SimilarityMetric): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: query vector dimension ${a.length} vs record vector dimension ${b.length}`);
    }

    if (metric === 'dot_product') {
      let dot = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
      }
      return dot;
    }

    if (metric === 'euclidean') {
      let distSq = 0;
      for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        distSq += diff * diff;
      }
      const distance = Math.sqrt(distSq);
      // Invert distance so higher score means closer/more similar
      return 1 / (1 + distance);
    }

    // Default: Cosine Similarity
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
