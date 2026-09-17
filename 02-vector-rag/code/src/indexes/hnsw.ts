import { IndexSearchResult, VectorIndex } from './base';
import { HNSWConfig, SimilarityMetric, VectorRecord } from '../schemas';
import { VectorMath } from '../math/vectorMath';

interface HNSWNode {
  id: string;
  record: VectorRecord;
  level: number;
  /**
   * Neighbors per level: neighbors[level] is an Array of node IDs
   */
  neighbors: Map<number, string[]>;
}

/**
 * Production-grade Hierarchical Navigable Small World (HNSW) ANN Index.
 * Implements multi-layer skip-list graph navigation for O(log N) approximate nearest neighbor vector search.
 */
export class HNSWIndex implements VectorIndex {
  private M: number;
  private M0: number;
  private efConstruction: number;
  private efSearch: number;
  private ml: number;

  private nodes: Map<string, HNSWNode> = new Map();
  private entryPointId: string | null = null;
  private maxLevel: number = -1;

  constructor(config: HNSWConfig = {}) {
    this.M = config.M ?? 16;
    this.M0 = this.M * 2;
    this.efConstruction = config.efConstruction ?? 64;
    this.efSearch = config.efSearch ?? 32;
    this.ml = 1 / Math.log(this.M);
  }

  public async insert(record: VectorRecord): Promise<void> {
    const level = this.getRandomLevel();
    const newNode: HNSWNode = {
      id: record.id,
      record,
      level,
      neighbors: new Map(),
    };

    for (let l = 0; l <= level; l++) {
      newNode.neighbors.set(l, []);
    }

    if (!this.entryPointId || this.nodes.size === 0) {
      this.nodes.set(record.id, newNode);
      this.entryPointId = record.id;
      this.maxLevel = level;
      return;
    }

    let currObjId = this.entryPointId;
    let currDist = VectorMath.computeDistance(record.vector, this.nodes.get(currObjId)!.record.vector, 'cosine');

    // 1. Zoom down from top level to level + 1
    for (let l = this.maxLevel; l > level; l--) {
      let changed = true;
      while (changed) {
        changed = false;
        const neighbors = this.nodes.get(currObjId)?.neighbors.get(l) ?? [];
        for (const neighborId of neighbors) {
          const neighborNode = this.nodes.get(neighborId);
          if (!neighborNode) continue;
          const dist = VectorMath.computeDistance(record.vector, neighborNode.record.vector, 'cosine');
          if (dist < currDist) {
            currDist = dist;
            currObjId = neighborId;
            changed = true;
          }
        }
      }
    }

    // 2. Insert into levels from min(level, maxLevel) down to 0
    for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
      const candidates = this.searchLayer(record.vector, [currObjId], this.efConstruction, l);
      const mMax = l === 0 ? this.M0 : this.M;
      const neighborsToConnect = candidates.slice(0, mMax);

      for (const candidate of neighborsToConnect) {
        newNode.neighbors.get(l)!.push(candidate.id);
        const neighborNode = this.nodes.get(candidate.id);
        if (neighborNode) {
          const neighborList = neighborNode.neighbors.get(l) ?? [];
          neighborList.push(newNode.id);
          neighborNode.neighbors.set(l, neighborList);

          // Prune neighbors if exceeding max degree
          if (neighborList.length > mMax) {
            this.pruneNeighbors(neighborNode, l, mMax);
          }
        }
      }

      if (candidates.length > 0) {
        currObjId = candidates[0].id;
      }
    }

    this.nodes.set(record.id, newNode);

    if (level > this.maxLevel) {
      this.maxLevel = level;
      this.entryPointId = record.id;
    }
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
    if (!this.entryPointId || this.nodes.size === 0) {
      return [];
    }

    let currObjId = this.entryPointId;
    let currDist = VectorMath.computeDistance(queryVector, this.nodes.get(currObjId)!.record.vector, metric);

    // Zoom down from top layer to layer 1
    for (let l = this.maxLevel; l > 0; l--) {
      let changed = true;
      while (changed) {
        changed = false;
        const neighbors = this.nodes.get(currObjId)?.neighbors.get(l) ?? [];
        for (const neighborId of neighbors) {
          const neighborNode = this.nodes.get(neighborId);
          if (!neighborNode) continue;
          const dist = VectorMath.computeDistance(queryVector, neighborNode.record.vector, metric);
          if (dist < currDist) {
            currDist = dist;
            currObjId = neighborId;
            changed = true;
          }
        }
      }
    }

    // Dynamic search at layer 0 using efSearch
    const candidates = this.searchLayer(queryVector, [currObjId], Math.max(this.efSearch, topK), 0, metric);

    const results: IndexSearchResult[] = [];
    for (const cand of candidates) {
      const node = this.nodes.get(cand.id);
      if (!node) continue;
      if (filterFn && !filterFn(node.record)) {
        continue;
      }

      let score: number;
      if (metric === 'cosine') {
        const rawSim = VectorMath.cosineSimilarity(queryVector, node.record.vector);
        score = VectorMath.distanceToScore(rawSim, 'cosine');
      } else if (metric === 'dot_product') {
        const dot = VectorMath.dotProduct(queryVector, node.record.vector);
        score = VectorMath.distanceToScore(dot, 'dot_product');
      } else {
        score = VectorMath.distanceToScore(cand.dist, metric);
      }

      results.push({
        record: node.record,
        distance: cand.dist,
        score,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  public async remove(id: string): Promise<boolean> {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove from all neighbor references
    for (let l = 0; l <= node.level; l++) {
      const neighbors = node.neighbors.get(l) ?? [];
      for (const nId of neighbors) {
        const neighborNode = this.nodes.get(nId);
        if (neighborNode) {
          const nList = neighborNode.neighbors.get(l) ?? [];
          neighborNode.neighbors.set(
            l,
            nList.filter((item) => item !== id)
          );
        }
      }
    }

    this.nodes.delete(id);

    if (this.entryPointId === id) {
      const nextKey = this.nodes.keys().next().value;
      this.entryPointId = nextKey ?? null;
      if (!this.entryPointId) {
        this.maxLevel = -1;
      }
    }

    return true;
  }

  public async clear(): Promise<void> {
    this.nodes.clear();
    this.entryPointId = null;
    this.maxLevel = -1;
  }

  public count(): number {
    return this.nodes.size;
  }

  private searchLayer(
    queryVector: number[],
    entryPoints: string[],
    ef: number,
    level: number,
    metric: SimilarityMetric = 'cosine'
  ): { id: string; dist: number }[] {
    const visited = new Set<string>(entryPoints);
    const candidateQueue: { id: string; dist: number }[] = [];
    const resultSet: { id: string; dist: number }[] = [];

    for (const epId of entryPoints) {
      const node = this.nodes.get(epId);
      if (!node) continue;
      const dist = VectorMath.computeDistance(queryVector, node.record.vector, metric);
      candidateQueue.push({ id: epId, dist });
      resultSet.push({ id: epId, dist });
    }

    candidateQueue.sort((a, b) => a.dist - b.dist);

    while (candidateQueue.length > 0) {
      const curr = candidateQueue.shift()!;
      const furthestResultDist = resultSet.length > 0 ? resultSet[resultSet.length - 1].dist : Infinity;

      if (curr.dist > furthestResultDist && resultSet.length >= ef) {
        break;
      }

      const currNode = this.nodes.get(curr.id);
      if (!currNode) continue;

      const neighbors = currNode.neighbors.get(level) ?? [];
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        const dist = VectorMath.computeDistance(queryVector, neighborNode.record.vector, metric);

        if (dist < furthestResultDist || resultSet.length < ef) {
          candidateQueue.push({ id: neighborId, dist });
          candidateQueue.sort((a, b) => a.dist - b.dist);

          resultSet.push({ id: neighborId, dist });
          resultSet.sort((a, b) => a.dist - b.dist);

          if (resultSet.length > ef) {
            resultSet.pop();
          }
        }
      }
    }

    return resultSet;
  }

  private pruneNeighbors(node: HNSWNode, level: number, maxNeighbors: number): void {
    const neighbors = node.neighbors.get(level) ?? [];
    const scored: { id: string; dist: number }[] = [];

    for (const nId of neighbors) {
      const nNode = this.nodes.get(nId);
      if (!nNode) continue;
      const dist = VectorMath.computeDistance(node.record.vector, nNode.record.vector, 'cosine');
      scored.push({ id: nId, dist });
    }

    scored.sort((a, b) => a.dist - b.dist);
    node.neighbors.set(
      level,
      scored.slice(0, maxNeighbors).map((item) => item.id)
    );
  }

  private getRandomLevel(): number {
    const r = Math.random();
    return Math.floor(-Math.log(r === 0 ? 1e-9 : r) * this.ml);
  }
}
