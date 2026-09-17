# Chapter 4 — Vector Embedding Models & Provider Adapters

Embedding models convert textual concepts into high-dimensional numerical vector arrays ($\mathbf{v} \in \mathbb{R}^d$). Words or paragraphs with similar semantic meanings map to nearby coordinates in vector space.

```text
"How does authentication work?" ───► [0.021, -0.184, 0.723, ..., 0.051]
```

In this chapter, we cover:
1. [src/embeddings/base.ts](../code/src/embeddings/base.ts) — The `EmbeddingModel` interface contract.
2. [src/embeddings/mock.ts](../code/src/embeddings/mock.ts) — Deterministic hash vectorizer for zero-dependency offline testing.
3. [src/embeddings/openai.ts](../code/src/embeddings/openai.ts) — `OpenAIEmbeddingModel` adapter.
4. [src/embeddings/gemini.ts](../code/src/embeddings/gemini.ts) — `GeminiEmbeddingModel` adapter.
5. [tests/embeddings.test.ts](../code/tests/embeddings.test.ts) — Jest unit test suite for embedding models.

---

## 1. Vector Space & $L_2$ Normalization

Given a raw vector $\mathbf{v} = [v_1, v_2, \dots, v_d]$, its Euclidean norm (length) $\|\mathbf{v}\|_2$ is computed as:

$$ \|\mathbf{v}\|_2 = \sqrt{\sum_{i=1}^d v_i^2} $$

The $L_2$ unit normalized vector $\mathbf{v}_{\text{norm}}$ is calculated as:

$$ \mathbf{v}_{\text{norm}} = \frac{\mathbf{v}}{\|\mathbf{v}\|_2} = \left[ \frac{v_1}{\|\mathbf{v}\|_2}, \frac{v_2}{\|\mathbf{v}\|_2}, \dots, \frac{v_d}{\|\mathbf{v}\|_2} \right] $$

*Properties of $L_2$ normalized vectors*:
- Length of $\mathbf{v}_{\text{norm}}$ is exactly 1: $\|\mathbf{v}_{\text{norm}}\|_2 = 1.0$.
- Cosine similarity between two $L_2$ normalized vectors simplifies directly to their **Dot Product**:

$$ \text{CosineSimilarity}(\mathbf{A}_{\text{norm}}, \mathbf{B}_{\text{norm}}) = \mathbf{A}_{\text{norm}} \cdot \mathbf{B}_{\text{norm}} $$

---

## 2. Embedding Model Interface ([src/embeddings/base.ts](../code/src/embeddings/base.ts))

### Full Source Code

```typescript
export interface EmbeddingModel {
  /**
   * Embed a single text string into a numeric vector.
   */
  embedQuery(text: string): Promise<number[]>;

  /**
   * Embed a batch of text strings into numeric vectors.
   */
  embedDocuments(texts: string[]): Promise<number[][]>;

  /**
   * Vector dimension size.
   */
  dimension(): number;
}
```

---

## 3. Deterministic Mock Embedder ([src/embeddings/mock.ts](../code/src/embeddings/mock.ts))

To enable instant unit testing without API keys or network latency, `MockEmbeddingModel` hashes token strings deterministically into fixed vector dimensions ($d=64$) and applies $L_2$ unit normalization.

### Full Source Code

```typescript
import { EmbeddingModel } from './base';

export class MockEmbeddingModel implements EmbeddingModel {
  private dim: number;

  constructor(dim: number = 64) {
    this.dim = dim;
  }

  dimension(): number {
    return this.dim;
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.generateVector(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateVector(t));
  }

  private generateVector(text: string): number[] {
    const vector = new Array(this.dim).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const tokens = normalized.split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      vector[0] = 1.0;
      return vector;
    }

    // Map token hashes to vector dimensions
    tokens.forEach((token) => {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const idx = Math.abs(hash) % this.dim;
      vector[idx] += 1.0;
    });

    // Apply L2 normalization
    let norm = 0;
    for (let i = 0; i < this.dim; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.dim; i++) {
        vector[i] /= norm;
      }
    } else {
      vector[0] = 1.0;
    }

    return vector;
  }
}
```

### 💡 Line-by-Line Breakdown & Rationale

1. **Lines 70–73 (Tokenization)**:
   - Converts input text to lowercase and strips special characters (`[^a-z0-9\s]`).
   - Splits on whitespace into token strings.

2. **Lines 81–89 (32-Bit Bitwise Hash Distribution)**:
   - Uses bitwise hash `(hash << 5) - hash + token.charCodeAt(i)` (equivalent to `hash * 31 + char`).
   - Maps each token's hash to a vector index `Math.abs(hash) % this.dim` and increments frequency count.

3. **Lines 92–104 ($L_2$ Normalization Routine)**:
   - Calculates Euclidean norm `norm = Math.sqrt(sum(v_i^2))`.
   - Divides each vector dimension by `norm` to yield a unit vector where $\|\mathbf{v}\|_2 = 1.0$.

---

## 4. OpenAI Embedding Adapter ([src/embeddings/openai.ts](../code/src/embeddings/openai.ts))

Integration with OpenAI's REST API (`text-embedding-3-small`, $d=1536$).

### Full Source Code

```typescript
import { EmbeddingModel } from './base';

export class OpenAIEmbeddingModel implements EmbeddingModel {
  private apiKey: string;
  private model: string;
  private dim: number;

  constructor(apiKey: string, model: string = 'text-embedding-3-small', dimension: number = 1536) {
    if (!apiKey) {
      throw new Error('OpenAI API Key is required for OpenAIEmbeddingModel');
    }
    this.apiKey = apiKey;
    this.model = model;
    this.dim = dimension;
  }

  dimension(): number {
    return this.dim;
  }

  async embedQuery(text: string): Promise<number[]> {
    const res = await this.embedDocuments([text]);
    return res[0];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Embedding API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    return json.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }
}
```

### 💡 Key Details
- **Batch Processing**: Sends multiple document texts in a single HTTP POST request to `https://api.openai.com/v1/embeddings`.
- **Index Sorting**: Sorts returned embeddings by item `index` to ensure output array order strictly matches input array order.

---

## 5. Google Gemini Embedding Adapter ([src/embeddings/gemini.ts](../code/src/embeddings/gemini.ts))

Integration with Google Gemini REST API (`models/text-embedding-004`, $d=768$).

### Full Source Code

```typescript
import { EmbeddingModel } from './base';

export class GeminiEmbeddingModel implements EmbeddingModel {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'models/text-embedding-004') {
    if (!apiKey) {
      throw new Error('Gemini API Key is required for GeminiEmbeddingModel');
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  dimension(): number {
    return 768;
  }

  async embedQuery(text: string): Promise<number[]> {
    const res = await this.embedDocuments([text]);
    return res[0];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/${this.model}:batchEmbedContents?key=${this.apiKey}`;
    const requests = texts.map((t) => ({
      model: this.model,
      content: { parts: [{ text: t }] },
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini Embedding API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as {
      embeddings: Array<{ values: number[] }>;
    };

    return json.embeddings.map((e) => e.values);
  }
}
```

---

## 6. Embedding Model Unit Tests ([tests/embeddings.test.ts](../code/tests/embeddings.test.ts))

### Full Source Code

```typescript
import { MockEmbeddingModel } from '../src/embeddings/mock';

describe('MockEmbeddingModel', () => {
  const embedder = new MockEmbeddingModel(32);

  test('dimension returns specified vector size', () => {
    expect(embedder.dimension()).toBe(32);
  });

  test('embedQuery generates normalized vector', async () => {
    const vec = await embedder.embedQuery('RAG Architecture');
    expect(vec).toHaveLength(32);
    // Check vector norm ~ 1.0
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  test('semantically identical texts have identical vectors', async () => {
    const vec1 = await embedder.embedQuery('Vector Database Similarity');
    const vec2 = await embedder.embedQuery('Vector Database Similarity');
    expect(vec1).toEqual(vec2);
  });
});
```

### 💡 Unit Test Coverage Summary
- Verifies output vector dimension matches requested size ($d=32$).
- Validates $L_2$ norm equals 1.0 (`expect(norm).toBeCloseTo(1.0, 4)`).
- Verifies determinism: identical text inputs produce identical vector representations.
