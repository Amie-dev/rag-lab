# Chapter 2 — Flat Exact Search Vector Index

The **Flat Index** is an exact, brute-force vector index that calculates vector distances against every stored record in the database.

While its query complexity scales linearly $O(N \cdot d)$, it guarantees **100% search recall**, serving as the ground-truth benchmark baseline against which Approximate Nearest Neighbor (ANN) algorithms (such as HNSW and IVF) are evaluated.

Source code locations:
- [`src/indexes/base.ts`](../code/src/indexes/base.ts)
- [`src/indexes/flat.ts`](../code/src/indexes/flat.ts)

---

## 1. VectorIndex Interface Contract

All vector search strategies implement the common `VectorIndex` interface defined in [`src/indexes/base.ts`](../code/src/indexes/base.ts):

```typescript
import { SimilarityMetric, VectorRecord } from '../schemas';

export interface IndexSearchResult {
  record: VectorRecord;
  distance: number;
  score: number;
}

export interface VectorIndex {
  insert(record: VectorRecord): Promise<void>;
  insertBatch(records: VectorRecord[]): Promise<void>;
  search(
    queryVector: number[],
    topK: number,
    metric: SimilarityMetric,
    filterFn?: (record: VectorRecord) => boolean
  ): Promise<IndexSearchResult[]>;
  remove(id: string): Promise<boolean>;
  clear(): Promise<void>;
  count(): number;
}
```

---

## 2. Flat Index Algorithm & Implementation

The `FlatIndex` stores records in an in-memory `Map<string, VectorRecord>`. On `search()`, it iterates over all stored records, evaluates pre-filtering predicate functions, computes raw vector distances, maps distance to normalized similarity scores, and sorts the top-$K$ candidates.

```typescript
import { IndexSearchResult, VectorIndex } from './base';
import { SimilarityMetric, VectorRecord } from '../schemas';
import { VectorMath } from '../math/vectorMath';

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

      results.push({ record, distance: rawDist, score });
    }

    // Sort by score descending (highest similarity first)
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
```

---

## 3. Tradeoffs & Performance Analysis

| Metric | Flat (Brute-Force) Index |
| :--- | :--- |
| **Search Time Complexity** | $O(N \cdot d)$ where $N$ = total records, $d$ = dimensions |
| **Indexing Complexity** | $O(1)$ constant time vector insertion |
| **Recall Rate** | **100% Exact Recall** (No approximation loss) |
| **Best Use Case** | Small datasets ($N < 10,000$), strict exact-match auditing, and ground-truth benchmarking |
