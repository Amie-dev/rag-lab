# Chapter 0 — Vector Space Foundations & Distance Metrics Mathematics

In **Vector RAG**, documents and queries are transformed into dense numeric vectors embedded in a high-dimensional continuous vector space. Text segments with similar semantic meaning are mapped to vectors positioned close to one another in this vector space.

This chapter details the mathematical formulations and algorithms behind vector metrics and operations implemented in [`vectorMath.ts`](../code/src/math/vectorMath.ts).

---

## 1. Vector Space & Embeddings

Given a vocabulary and semantic embedding model $E: \text{Text} \rightarrow \mathbb{R}^d$, a text snippet $T$ is projected into a $d$-dimensional vector:

$$
v = E(T) = [v_1, v_2, \dots, v_d] \in \mathbb{R}^d
$$

Where $d$ represents the vector dimensionality (e.g., $d = 128$ for mock embeddings, $d = 768$ for Gemini `text-embedding-004`, or $d = 1536$ for OpenAI `text-embedding-3-small`).

---

## 2. Mathematical Formulations of Vector Distance & Similarity Metrics

### A. Cosine Similarity & Cosine Distance

Cosine similarity measures the cosine of the angle $\theta$ between two vectors $A$ and $B$, independent of their magnitude:

$$
\text{CosineSimilarity}(A, B) = \cos(\theta) = \frac{A \cdot B}{\|A\|_2 \|B\|_2} = \frac{\sum_{i=1}^d A_i B_i}{\sqrt{\sum_{i=1}^d A_i^2} \sqrt{\sum_{i=1}^d B_i^2}}
$$

- Range: $[-1.0, 1.0]$ where $1.0$ indicates identical direction, $0.0$ orthogonal, and $-1.0$ opposite directions.
- **Cosine Distance**:

$$
d_{\text{cosine}}(A, B) = 1 - \text{CosineSimilarity}(A, B) \in [0.0, 2.0]
$$

### B. Dot Product (Inner Product)

The dot product measures both directional alignment and magnitude interaction:

$$
\text{DotProduct}(A, B) = A \cdot B = \sum_{i=1}^d A_i B_i
$$

> 💡 **Key Property**: When vectors $A$ and $B$ are $L_2$-normalized ($\|A\|_2 = \|B\|_2 = 1.0$), Dot Product is **exactly equal** to Cosine Similarity:
> $$
> A_{\text{norm}} \cdot B_{\text{norm}} = \frac{A \cdot B}{1 \cdot 1} = \cos(\theta)
> $$

### C. Euclidean Distance ($L_2$ Norm)

Euclidean distance measures the straight-line Cartesian distance between vector endpoints in $\mathbb{R}^d$:

$$
d_{L2}(A, B) = \|A - B\|_2 = \sqrt{\sum_{i=1}^d (A_i - B_i)^2}
$$

- Range: $[0.0, \infty)$. Smaller values represent closer semantic distance.

### D. Manhattan Distance ($L_1$ Norm)

Manhattan distance sums the absolute differences across vector dimensions:

$$
d_{L1}(A, B) = \|A - B\|_1 = \sum_{i=1}^d |A_i - B_i|
$$

---

## 3. Vector $L_2$-Normalization

To normalize a vector $v$ to unit magnitude:

$$
v_{\text{normalized}} = \frac{v}{\|v\|_2} = \frac{v}{\sqrt{\sum_{i=1}^d v_i^2}}
$$

Normalization eliminates length variance bias during vector search.

---

## 4. Distance-to-Score Normalization

In production RAG systems, user interfaces require a normalized similarity score $S \in [0.0, 1.0]$ where higher values mean higher relevance:

$$
S_{\text{cosine}}(r) = \frac{r + 1}{2} \quad \text{for raw cosine similarity } r \in [-1, 1]
$$

$$
S_{L2}(d) = \frac{1}{1 + d} \quad \text{for Euclidean distance } d \ge 0
$$

$$
S_{\text{dot}}(p) = \sigma(p) = \frac{1}{1 + e^{-p}} \quad \text{for dot product } p
$$

---

## 5. TypeScript Code Implementation

The complete vector math engine is defined in [`src/math/vectorMath.ts`](../code/src/math/vectorMath.ts):

```typescript
import { SimilarityMetric } from '../schemas';

export class VectorMath {
  public static dotProduct(a: number[], b: number[]): number {
    this.assertMatchingDimensions(a, b);
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  public static magnitude(v: number[]): number {
    let sum = 0;
    for (let i = 0; i < v.length; i++) {
      sum += v[i] * v[i];
    }
    return Math.sqrt(sum);
  }

  public static l2Normalize(v: number[]): number[] {
    const mag = this.magnitude(v);
    if (mag === 0) return [...v];
    return v.map((val) => val / mag);
  }

  public static cosineSimilarity(a: number[], b: number[]): number {
    this.assertMatchingDimensions(a, b);
    const magA = this.magnitude(a);
    const magB = this.magnitude(b);
    if (magA === 0 || magB === 0) return 0;
    const dot = this.dotProduct(a, b);
    return Math.max(-1, Math.min(1, dot / (magA * magB)));
  }

  public static euclideanDistance(a: number[], b: number[]): number {
    this.assertMatchingDimensions(a, b);
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  public static distanceToScore(rawVal: number, metric: SimilarityMetric): number {
    switch (metric) {
      case 'cosine':
        if (rawVal >= -1 && rawVal <= 1) return (rawVal + 1) / 2;
        return Math.max(0, 1 - rawVal / 2);
      case 'dot_product':
        return 1 / (1 + Math.exp(-rawVal));
      case 'euclidean':
      case 'manhattan':
        return 1 / (1 + rawVal);
      default:
        return 0;
    }
  }

  private static assertMatchingDimensions(a: number[], b: number[]): void {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }
  }
}
```

---

## 6. Unit Testing Verification

The vector math suite is tested in [`tests/vectorMath.test.ts`](../code/tests/vectorMath.test.ts):

```typescript
describe('VectorMath Utility Suite', () => {
  it('should compute exact dot product', () => {
    expect(VectorMath.dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it('should compute unit L2 normalized vector', () => {
    const norm = VectorMath.l2Normalize([3, 4]);
    expect(VectorMath.magnitude(norm)).toBeCloseTo(1.0);
  });
});
```
