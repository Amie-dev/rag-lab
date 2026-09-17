import { IndexSearchResult, VectorIndex } from './base';
import { IVFConfig, SimilarityMetric, VectorRecord } from '../schemas';
import { VectorMath } from '../math/vectorMath';

interface Centroid {
  id: number;
  vector: number[];
  list: VectorRecord[];
}

/**
 * Production-grade Inverted File (IVF) ANN Vector Index.
 * Clusters vectors into coarse Voronoi cells via K-means centroids and queries top nprobe clusters.
 */
export class IVFIndex implements VectorIndex {
  private numLists: number;
  private nprobe: number;
  private kmeansIterations: number;
  private centroids: Centroid[] = [];
  private isTrained: boolean = false;
  private unassignedRecords: VectorRecord[] = [];

  constructor(config: IVFConfig = {}) {
    this.numLists = config.numLists ?? 8;
    this.nprobe = config.nprobe ?? 3;
    this.kmeansIterations = config.kmeansIterations ?? 10;
  }

  public async insert(record: VectorRecord): Promise<void> {
    if (!this.isTrained) {
      this.unassignedRecords.push(record);
      // Train centroids once we have enough sample records
      if (this.unassignedRecords.length >= Math.max(this.numLists * 2, 10)) {
        await this.trainAndReassign();
      }
      return;
    }

    const nearestCentroid = this.findNearestCentroid(record.vector);
    nearestCentroid.list.push(record);
  }

  public async insertBatch(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      await this.insert(record);
    }
  }

  public async search(
    queryVector: number[],
    topK: number,
    metric: SimilarityMetric = 'cosine',
    filterFn?: (record: VectorRecord) => boolean
  ): Promise<IndexSearchResult[]> {
    // If not trained yet, perform search across unassigned records
    const candidateRecords: VectorRecord[] = [];

    if (!this.isTrained) {
      candidateRecords.push(...this.unassignedRecords);
    } else {
      // Find top nprobe nearest centroids
      const centroidDistances = this.centroids.map((c) => ({
        centroid: c,
        dist: VectorMath.computeDistance(queryVector, c.vector, metric),
      }));

      centroidDistances.sort((a, b) => a.dist - b.dist);
      const probedCentroids = centroidDistances.slice(0, Math.min(this.nprobe, this.centroids.length));

      for (const item of probedCentroids) {
        candidateRecords.push(...item.centroid.list);
      }
      candidateRecords.push(...this.unassignedRecords);
    }

    const results: IndexSearchResult[] = [];

    for (const record of candidateRecords) {
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

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  public async remove(id: string): Promise<boolean> {
    this.unassignedRecords = this.unassignedRecords.filter((r) => r.id !== id);
    let removed = false;

    for (const c of this.centroids) {
      const initLen = c.list.length;
      c.list = c.list.filter((r) => r.id !== id);
      if (c.list.length < initLen) {
        removed = true;
      }
    }

    return removed;
  }

  public async clear(): Promise<void> {
    this.centroids = [];
    this.unassignedRecords = [];
    this.isTrained = false;
  }

  public count(): number {
    let sum = this.unassignedRecords.length;
    for (const c of this.centroids) {
      sum += c.list.length;
    }
    return sum;
  }

  private async trainAndReassign(): Promise<void> {
    const allRecords = [...this.unassignedRecords];
    for (const c of this.centroids) {
      allRecords.push(...c.list);
    }

    if (allRecords.length === 0) return;

    const actualK = Math.min(this.numLists, allRecords.length);
    const dim = allRecords[0].vector.length;

    // Initialize centroids with k random vectors
    const selectedIndices = new Set<number>();
    this.centroids = [];

    while (this.centroids.length < actualK) {
      const idx = Math.floor(Math.random() * allRecords.length);
      if (!selectedIndices.has(idx)) {
        selectedIndices.add(idx);
        this.centroids.push({
          id: this.centroids.length,
          vector: [...allRecords[idx].vector],
          list: [],
        });
      }
    }

    // Run K-Means Iterations
    for (let iter = 0; iter < this.kmeansIterations; iter++) {
      for (const c of this.centroids) {
        c.list = [];
      }

      // Assign each vector to closest centroid
      for (const record of allRecords) {
        const nearest = this.findNearestCentroid(record.vector);
        nearest.list.push(record);
      }

      // Recompute centroids
      for (const c of this.centroids) {
        if (c.list.length === 0) continue;
        const newVec = new Array(dim).fill(0);
        for (const record of c.list) {
          for (let d = 0; d < dim; d++) {
            newVec[d] += record.vector[d];
          }
        }
        for (let d = 0; d < dim; d++) {
          newVec[d] /= c.list.length;
        }
        c.vector = VectorMath.l2Normalize(newVec);
      }
    }

    this.unassignedRecords = [];
    this.isTrained = true;
  }

  private findNearestCentroid(vector: number[]): Centroid {
    let minDist = Infinity;
    let closest = this.centroids[0];

    for (const c of this.centroids) {
      const dist = VectorMath.computeDistance(vector, c.vector, 'cosine');
      if (dist < minDist) {
        minDist = dist;
        closest = c;
      }
    }

    return closest;
  }
}
