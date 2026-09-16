# Chapter 5 — In-Memory Vector Database & Similarity Search

The Vector Store indexes chunk embeddings and performs fast similarity searches to find the Top-K most relevant chunks for a user question.

### Similarity Formulas Supported

1. **Cosine Similarity**:
   Measures the cosine of the angle between query vector $\mathbf{A}$ and chunk vector $\mathbf{B}$:
   $$ \text{CosineSimilarity}(\mathbf{A}, \mathbf{B}) = \frac{\mathbf{A} \cdot \mathbf{B}}{\|\mathbf{A}\|_2 \|\mathbf{B}\|_2} = \frac{\sum_{i=1}^d A_i B_i}{\sqrt{\sum_{i=1}^d A_i^2} \sqrt{\sum_{i=1}^d B_i^2}} $$

2. **Dot Product**:
   $$ \text{DotProduct}(\mathbf{A}, \mathbf{B}) = \sum_{i=1}^d A_i B_i $$

3. **Euclidean Distance**:
   $$ \text{EuclideanDistance}(\mathbf{A}, \mathbf{B}) = \sqrt{\sum_{i=1}^d (A_i - B_i)^2} $$
   *Note: Inverted to similarity score $ S = \frac{1}{1 + D} $ so higher values mean closer candidates.*

---

## 1. Vector Store Interface (`src/vectordb/base.ts`)

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

## 2. In-Memory Vector Store (`src/vectordb/inMemory.ts`)

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
