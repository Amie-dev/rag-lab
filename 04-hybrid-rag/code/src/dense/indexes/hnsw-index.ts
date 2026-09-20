import { VectorRecord, SimilarityMetric, DenseRetrievalResult } from '../../schemas';
import { VectorIndex } from './flat-index';
import { computeDistance } from '../metrics';

interface HNSWNode {
  record: VectorRecord;
  level: number;
  neighbors: Map<number, Set<string>>; // level -> set of record IDs
}

export interface HNSWConfig {
  M?: number;              // Max connections per node (default: 16)
  efConstruction?: number; // Candidate pool size during indexing (default: 64)
  efSearch?: number;       // Candidate pool size during search (default: 32)
}

export class HNSWVectorIndex implements VectorIndex {
  private nodes: Map<string, HNSWNode> = new Map();
  private entryPointId: string | null = null;
  private maxLevel: number = 0;
  private metric: SimilarityMetric;

  private M: number;
  private efConstruction: number;
  private efSearch: number;

  constructor(metric: SimilarityMetric = 'cosine', config?: HNSWConfig) {
    this.metric = metric;
    this.M = config?.M ?? 16;
    this.efConstruction = config?.efConstruction ?? 64;
    this.efSearch = config?.efSearch ?? 32;
  }

  add(record: VectorRecord): void {
    const level = this.getRandomLevel();
    const newNode: HNSWNode = {
      record,
      level,
      neighbors: new Map()
    };

    for (let l = 0; l <= level; l++) {
      newNode.neighbors.set(l, new Set());
    }

    this.nodes.set(record.id, newNode);

    if (!this.entryPointId) {
      this.entryPointId = record.id;
      this.maxLevel = level;
      return;
    }

    // Connect to existing entry point across layers
    let currentEntryIds = [this.entryPointId];

    for (let l = this.maxLevel; l > level; l--) {
      currentEntryIds = this.searchLayer(record.vector, currentEntryIds, 1, l).map((r) => r.recordId);
    }

    for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
      const candidates = this.searchLayer(record.vector, currentEntryIds, this.efConstruction, l);
      currentEntryIds = candidates.map((c) => c.recordId);

      // Add bi-directional edges for level l
      const neighborSet = newNode.neighbors.get(l)!;
      candidates.slice(0, this.M).forEach((cand) => {
        neighborSet.add(cand.recordId);
        const targetNode = this.nodes.get(cand.recordId);
        if (targetNode && targetNode.neighbors.has(l)) {
          targetNode.neighbors.get(l)!.add(record.id);
        }
      });
    }

    if (level > this.maxLevel) {
      this.maxLevel = level;
      this.entryPointId = record.id;
    }
  }

  addBatch(records: VectorRecord[]): void {
    for (const record of records) {
      this.add(record);
    }
  }

  search(queryVector: number[], topK: number): DenseRetrievalResult[] {
    if (!this.entryPointId || this.nodes.size === 0) {
      return [];
    }

    let currentEntryIds = [this.entryPointId];

    for (let l = this.maxLevel; l > 0; l--) {
      currentEntryIds = this.searchLayer(queryVector, currentEntryIds, 1, l).map((r) => r.recordId);
    }

    const candidates = this.searchLayer(queryVector, currentEntryIds, Math.max(topK, this.efSearch), 0);
    
    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);

    const topResults = candidates.slice(0, topK);
    topResults.forEach((res, i) => {
      res.rank = i + 1;
    });

    return topResults;
  }

  private searchLayer(
    queryVector: number[],
    entryIds: string[],
    ef: number,
    level: number
  ): DenseRetrievalResult[] {
    const visited = new Set<string>(entryIds);
    const candidates: DenseRetrievalResult[] = [];

    for (const id of entryIds) {
      const node = this.nodes.get(id);
      if (node) {
        const { score, distance } = computeDistance(queryVector, node.record.vector, this.metric);
        candidates.push({
          recordId: id,
          chunk: node.record.chunk,
          score,
          distance,
          metric: this.metric,
          rank: 0
        });
      }
    }

    let changed = true;
    while (changed) {
      changed = false;
      candidates.sort((a, b) => b.score - a.score);

      const bestCandidate = candidates[0];
      const neighbors = this.nodes.get(bestCandidate?.recordId ?? '')?.neighbors.get(level);

      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            const neighborNode = this.nodes.get(neighborId);
            if (neighborNode) {
              const { score, distance } = computeDistance(queryVector, neighborNode.record.vector, this.metric);
              candidates.push({
                recordId: neighborId,
                chunk: neighborNode.record.chunk,
                score,
                distance,
                metric: this.metric,
                rank: 0
              });
              changed = true;
            }
          }
        }
      }

      if (candidates.length > ef) {
        candidates.length = ef;
      }
    }

    return candidates;
  }

  private getRandomLevel(): number {
    const ml = 1 / Math.log(this.M);
    let level = Math.floor(-Math.log(Math.random()) * ml);
    return Math.min(level, 4);
  }

  clear(): void {
    this.nodes.clear();
    this.entryPointId = null;
    this.maxLevel = 0;
  }

  size(): number {
    return this.nodes.size;
  }
}
