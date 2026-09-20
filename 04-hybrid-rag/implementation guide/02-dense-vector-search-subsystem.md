# ⚡ Chapter 2 — Dense Vector Search Subsystem

Welcome to Chapter 2 of the **Hybrid RAG Implementation Guide**. In this chapter, we explore the **Dense Vector Search Subsystem**, responsible for capturing semantic meaning and conceptual similarity.

All code snippets in this chapter are taken directly from [`04-hybrid-rag/code`](../code).

---

## 1. Vector Metrics Math (`src/dense/metrics.ts`)

File: [`04-hybrid-rag/code/src/dense/metrics.ts`](../code/src/dense/metrics.ts)

```typescript
import { SimilarityMetric } from '../schemas';

export function computeCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  
  // Clamp cosine similarity between -1 and 1
  const sim = dot / denom;
  return Math.max(-1, Math.min(1, sim));
}

export function computeDotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

export function computeEuclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

export function computeDistance(a: number[], b: number[], metric: SimilarityMetric): { score: number; distance: number } {
  switch (metric) {
    case 'cosine': {
      const score = computeCosineSimilarity(a, b);
      // Cosine distance = 1 - Cosine similarity
      return { score, distance: 1 - score };
    }
    case 'dot_product': {
      const score = computeDotProduct(a, b);
      return { score, distance: -score };
    }
    case 'euclidean': {
      const dist = computeEuclideanDistance(a, b);
      // Map distance to a normalized similarity score in [0, 1]
      const score = 1 / (1 + dist);
      return { score, distance: dist };
    }
    default:
      throw new Error(`Unsupported metric: ${metric}`);
  }
}
```

### Functions Explanation

- `computeCosineSimilarity(a, b)`: Calculates the cosine of the angle between vectors $a$ and $b$. Returns values in $[-1.0, 1.0]$. Clamps results to handle floating-point rounding precision.
- `computeDotProduct(a, b)`: Computes the inner product $\sum a_i b_i$. Used when embedding vectors are pre-normalized to unit length ($\|a\| = 1$).
- `computeEuclideanDistance(a, b)`: Calculates the straight-line distance $\|a - b\|_2 = \sqrt{\sum (a_i - b_i)^2}$.
- `computeDistance(a, b, metric)`: Dispatch function mapping distance values to a normalized similarity score $[0, 1]$ and distance metric.

---

## 2. Vector Index Implementations (`src/dense/indexes/`)

### A. Flat Vector Index (`src/dense/indexes/flat-index.ts`)

File: [`04-hybrid-rag/code/src/dense/indexes/flat-index.ts`](../code/src/dense/indexes/flat-index.ts)

```typescript
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
```

### Method Explanation (`FlatVectorIndex`)
- `add(record)` / `addBatch(records)`: Appends vector records to internal storage list.
- `search(queryVector, topK)`: Performs brute-force $O(N)$ similarity computation across all stored records, sorts descending by similarity score, truncates to `topK`, and assigns 1-indexed `rank` numbers.

---

### B. HNSW Vector Index (`src/dense/indexes/hnsw-index.ts`)

File: [`04-hybrid-rag/code/src/dense/indexes/hnsw-index.ts`](../code/src/dense/indexes/hnsw-index.ts)

```typescript
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

    let currentEntryIds = [this.entryPointId];

    for (let l = this.maxLevel; l > level; l--) {
      currentEntryIds = this.searchLayer(record.vector, currentEntryIds, 1, l).map((r) => r.recordId);
    }

    for (let l = Math.min(level, this.maxLevel); l >= 0; l--) {
      const candidates = this.searchLayer(record.vector, currentEntryIds, this.efConstruction, l);
      currentEntryIds = candidates.map((c) => c.recordId);

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
```

---

### C. IVF Vector Index (`src/dense/indexes/ivf-index.ts`)

File: [`04-hybrid-rag/code/src/dense/indexes/ivf-index.ts`](../code/src/dense/indexes/ivf-index.ts)

```typescript
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

    for (let i = 0; i < actualNumLists; i++) {
      this.centroids.push([...this.allRecords[i].vector]);
      this.invertedLists.set(i, []);
    }

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

    const centroidScores = this.centroids.map((centroid, index) => {
      const { score } = computeDistance(queryVector, centroid, this.metric);
      return { index, score };
    });

    centroidScores.sort((a, b) => b.score - a.score);

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
```

---

## 3. VectorStore Wrapper (`src/dense/vector-store.ts`)

File: [`04-hybrid-rag/code/src/dense/vector-store.ts`](../code/src/dense/vector-store.ts)

```typescript
import { Chunk, VectorRecord, DenseRetrievalResult, SimilarityMetric } from '../schemas';
import { EmbeddingModel } from '../embeddings/interface';
import { VectorIndex, FlatVectorIndex } from './indexes/flat-index';
import { HNSWVectorIndex } from './indexes/hnsw-index';
import { IVFVectorIndex } from './indexes/ivf-index';

export type IndexType = 'flat' | 'hnsw' | 'ivf';

export interface VectorStoreConfig {
  indexType?: IndexType;
  metric?: SimilarityMetric;
}

export class VectorStore {
  private embeddingModel: EmbeddingModel;
  private index: VectorIndex;
  private metric: SimilarityMetric;

  constructor(embeddingModel: EmbeddingModel, config?: VectorStoreConfig) {
    this.embeddingModel = embeddingModel;
    this.metric = config?.metric ?? 'cosine';
    const indexType = config?.indexType ?? 'flat';

    switch (indexType) {
      case 'hnsw':
        this.index = new HNSWVectorIndex(this.metric);
        break;
      case 'ivf':
        this.index = new IVFVectorIndex(this.metric);
        break;
      case 'flat':
      default:
        this.index = new FlatVectorIndex(this.metric);
        break;
    }
  }

  async addChunks(chunks: Chunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const texts = chunks.map((c) => c.content);
    const vectors = await this.embeddingModel.embedDocuments(texts);

    const records: VectorRecord[] = chunks.map((chunk, i) => ({
      id: chunk.id,
      vector: vectors[i],
      chunk,
      metadata: chunk.metadata
    }));

    this.index.addBatch(records);
  }

  async search(query: string, topK: number = 20): Promise<DenseRetrievalResult[]> {
    const queryVector = await this.embeddingModel.embedQuery(query);
    return this.index.search(queryVector, topK);
  }

  clear(): void {
    this.index.clear();
  }

  size(): number {
    return this.index.size();
  }
}
```

### Methods Explanation (`VectorStore`)
- `constructor(embeddingModel, config)`: Initializes the chosen vector index strategy (`flat`, `hnsw`, or `ivf`).
- `addChunks(chunks)`: Extracts text content, requests vector embeddings asynchronously from the embedding model, constructs `VectorRecord` instances, and inserts them into the index.
- `search(query, topK)`: Generates query vector embedding and calls `this.index.search`.

In [Chapter 3](./03-sparse-bm25-subsystem.md), we will inspect the **Sparse BM25 Search Subsystem**.
