import { VectorRecord, SimilarityMetric, DenseRetrievalResult } from '../../schemas';
import { VectorIndex } from './flat-index';
import { computeDistance } from '../metrics';

export interface IVFConfig {
  numLists?: number; // Number of centroids (default: 4)
  nprobe?: number;   // Number of centroids to probe during search (default: 2)
}

export class IVFVectorIndex implements VectorIndex {
  private centroids: number[][] = [];
  private invertedLists: Map<number, VectorRecord[]> = new Map();
  private allRecords: VectorRecord[] = [];
  private metric: SimilarityMetric;

  private numLists: number;
  private nprobe: number;
  private isTrained: boolean = false;

  constructor(metric: SimilarityMetric = 'cosine', config?: IVFConfig) {
    this.metric = metric;
    this.numLists = config?.numLists ?? 4;
    this.nprobe = config?.nprobe ?? 2;
  }

  add(record: VectorRecord): void {
    this.allRecords.push(record);
    this.isTrained = false;
  }

  addBatch(records: VectorRecord[]): void {
    this.allRecords.push(...records);
    this.isTrained = false;
  }

  private trainAndAssign(): void {
    if (this.allRecords.length === 0) return;

    const actualNumLists = Math.min(this.numLists, this.allRecords.length);
    this.centroids = [];
    this.invertedLists.clear();

    // Select initial centroids
    for (let i = 0; i < actualNumLists; i++) {
      this.centroids.push([...this.allRecords[i].vector]);
      this.invertedLists.set(i, []);
    }

    // Simple k-means clustering (2 iterations)
    for (let iter = 0; iter < 2; iter++) {
      const clusters: VectorRecord[][] = Array.from({ length: actualNumLists }, () => []);

      for (const record of this.allRecords) {
        let bestCentroidIdx = 0;
        let bestScore = -Infinity;

        for (let c = 0; c < actualNumLists; c++) {
          const { score } = computeDistance(record.vector, this.centroids[c], this.metric);
          if (score > bestScore) {
            bestScore = score;
            bestCentroidIdx = c;
          }
        }
        clusters[bestCentroidIdx].push(record);
      }

      // Update centroids
      for (let c = 0; c < actualNumLists; c++) {
        if (clusters[c].length > 0) {
          const dim = clusters[c][0].vector.length;
          const newCentroid = new Array(dim).fill(0);
          for (const rec of clusters[c]) {
            for (let d = 0; d < dim; d++) {
              newCentroid[d] += rec.vector[d];
            }
          }
          this.centroids[c] = newCentroid.map((val) => val / clusters[c].length);
        }
      }

      if (iter === 1) {
        for (let c = 0; c < actualNumLists; c++) {
          this.invertedLists.set(c, clusters[c]);
        }
      }
    }

    this.isTrained = true;
  }

  search(queryVector: number[], topK: number): DenseRetrievalResult[] {
    if (!this.isTrained) {
      this.trainAndAssign();
    }

    if (this.centroids.length === 0) {
      return [];
    }

    // Rank centroids relative to query vector
    const centroidScores = this.centroids.map((centroid, index) => {
      const { score } = computeDistance(queryVector, centroid, this.metric);
      return { index, score };
    });

    centroidScores.sort((a, b) => b.score - a.score);

    // Select top nprobe centroids
    const probedIndices = centroidScores.slice(0, this.nprobe).map((c) => c.index);

    const candidates: DenseRetrievalResult[] = [];
    for (const clusterIdx of probedIndices) {
      const records = this.invertedLists.get(clusterIdx) || [];
      for (const rec of records) {
        const { score, distance } = computeDistance(queryVector, rec.vector, this.metric);
        candidates.push({
          recordId: rec.id,
          chunk: rec.chunk,
          score,
          distance,
          metric: this.metric,
          rank: 0
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    const topResults = candidates.slice(0, topK);
    topResults.forEach((r, i) => {
      r.rank = i + 1;
    });

    return topResults;
  }

  clear(): void {
    this.centroids = [];
    this.invertedLists.clear();
    this.allRecords = [];
    this.isTrained = false;
  }

  size(): number {
    return this.allRecords.length;
  }
}
