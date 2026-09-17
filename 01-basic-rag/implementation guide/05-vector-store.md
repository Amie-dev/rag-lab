# Chapter 5 — In-Memory Vector Database & Similarity Search

The Vector Store indexes chunk vector embeddings and performs similarity searches to retrieve the Top-K most relevant chunks for a user query vector.

In this chapter, we cover:
1. Mathematical foundations of vector similarity metrics (Cosine, Dot Product, Euclidean Distance).
2. [src/vectordb/base.ts](../code/src/vectordb/base.ts) — The `VectorStore` interface contract.
3. [src/vectordb/inMemory.ts](../code/src/vectordb/inMemory.ts) — In-memory vector database implementation supporting dynamic similarity search and metadata filtering.
4. [tests/vectordb.test.ts](../code/tests/vectordb.test.ts) — Jest unit test suite for the vector store.

---

## 1. Vector Similarity Metrics Formulation

Let $\mathbf{A} \in \mathbb{R}^d$ be the query vector and $\mathbf{B} \in \mathbb{R}^d$ be a stored chunk vector.

### 1.1 Cosine Similarity
Measures the cosine of the angle between two vectors, ranging from $-1.0$ (opposite) to $+1.0$ (identical direction):

$$ \text{CosineSimilarity}(\mathbf{A}, \mathbf{B}) = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\|_2 \|\mathbf{B}\|_2} = \frac{\sum_{i=1}^d A_i B_i}{\sqrt{\sum_{i=1}^d A_i^2} \sqrt{\sum_{i=1}^d B_i^2}} $$

### 1.2 Dot Product
Measures directional similarity weighted by vector magnitudes:

$$ \text{DotProduct}(\mathbf{A}, \mathbf{B}) = \mathbf{A} \cdot \mathbf{B} = \sum_{i=1}^d A_i B_i $$

### 1.3 Euclidean Distance & Inverted Similarity
Measures the standard geometric distance between points in $d$-dimensional space:

$$ D_{\text{Euclidean}}(\mathbf{A}, \mathbf{B}) = \sqrt{\sum_{i=1}^d (A_i - B_i)^2} $$

To align Euclidean distance with similarity search (where higher scores mean closer candidates), we compute the inverted similarity score $S$:

$$ S = \frac{1}{1 + D_{\text{Euclidean}}(\mathbf{A}, \mathbf{B})} $$

---

## 2. Vector Store Interface ([src/vectordb/base.ts](../code/src/vectordb/base.ts))

### Full Source Code

```typescript
import { Chunk, VectorRecord, RetrievalResult, SimilarityMetric } from '../schemas';

export interface VectorStore {
  /**
   * Add chunk vector records into the vector database.
   */
  add(records: VectorRecord[]): Promise<void>;

  /**
   * Search top-K similar chunks for a given query vector.
   */
  search(
    queryVector: number[],
    topK: number,
    metric?: SimilarityMetric,
    filter?: (chunk: Chunk) => boolean
  ): Promise<RetrievalResult[]>;

  /**
   * Clear all records in the vector store.
   */
  clear(): Promise<void>;

  /**
   * Count total stored records.
   */
  count(): Promise<number>;
}
```

---

## 3. In-Memory Vector Store ([src/vectordb/inMemory.ts](../code/src/vectordb/inMemory.ts))

### Full Source Code

```typescript
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

    // Sort descending by score (highest similarity first)
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
      throw new Error(`Vector dimension mismatch: query vector (${a.length}) vs record vector (${b.length})`);
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
```

### 💡 Line-by-Line Breakdown & Rationale

1. **Lines 81–83 (Metadata Filter Execution)**:
   - If a custom boolean `filter` predicate is supplied, filters candidate vector records based on chunk metadata properties before running expensive floating-point distance math.

2. **Lines 85–97 (Similarity Scoring & Sorting)**:
   - Computes similarity score for every candidate vector via `calculateSimilarity()`.
   - Sorts results in descending order (`b.score - a.score`) so the most relevant chunks are ordered first.
   - Slices top $K$ records (`scored.slice(0, topK)`).

3. **Lines 109–111 (Dimension Validation Guard)**:
   - Throws explicit `Error` if `a.length !== b.length` to catch dimension mismatches between query and stored vectors.

---

## 4. Vector Store Unit Tests ([tests/vectordb.test.ts](../code/tests/vectordb.test.ts))

### Full Source Code

```typescript
import { InMemoryVectorStore } from '../src/vectordb/inMemory';
import { VectorRecord } from '../src/schemas';

describe('InMemoryVectorStore', () => {
  let store: InMemoryVectorStore;

  const records: VectorRecord[] = [
    {
      id: 'rec_1',
      vector: [1, 0, 0, 0],
      chunk: { id: 'c1', content: 'Vector DBs store embeddings', metadata: { documentId: 'd1', chunkIndex: 0, source: 's1' } },
      metadata: { documentId: 'd1', chunkIndex: 0, source: 's1' },
    },
    {
      id: 'rec_2',
      vector: [0.8, 0.2, 0, 0],
      chunk: { id: 'c2', content: 'Cosine similarity measures angles', metadata: { documentId: 'd1', chunkIndex: 1, source: 's1' } },
      metadata: { documentId: 'd1', chunkIndex: 1, source: 's1' },
    },
    {
      id: 'rec_3',
      vector: [0, 0, 1, 0],
      chunk: { id: 'c3', content: 'Unrelated topic context', metadata: { documentId: 'd2', chunkIndex: 0, source: 's2' } },
      metadata: { documentId: 'd2', chunkIndex: 0, source: 's2' },
    },
  ];

  beforeEach(async () => {
    store = new InMemoryVectorStore();
    await store.add(records);
  });

  test('stores records and reports count correctly', async () => {
    expect(await store.count()).toBe(3);
  });

  test('searches top-K with cosine similarity', async () => {
    const queryVec = [1, 0, 0, 0];
    const results = await store.search(queryVec, 2, 'cosine');
    expect(results).toHaveLength(2);
    expect(results[0].chunk.id).toBe('c1');
    expect(results[0].score).toBeCloseTo(1.0, 4);
    expect(results[1].chunk.id).toBe('c2');
  });

  test('filters results using metadata filter function', async () => {
    const queryVec = [1, 0, 0, 0];
    const results = await store.search(queryVec, 5, 'cosine', (chunk) => chunk.metadata.documentId === 'd2');
    expect(results).toHaveLength(1);
    expect(results[0].chunk.id).toBe('c3');
  });

  test('clears vector store', async () => {
    await store.clear();
    expect(await store.count()).toBe(0);
  });
});
```

### 💡 Test Assertions Summary
- **Record Insertion & Count**: Validates `add()` stores 3 records and `count()` returns `3`.
- **Cosine Search**: Verifies query vector `[1, 0, 0, 0]` ranks `c1` (score $1.0$) highest, followed by `c2`.
- **Metadata Filtering**: Verifies filter predicate `chunk.metadata.documentId === 'd2'` isolates record `c3`.
- **Clear Store**: Verifies `clear()` removes all records.
