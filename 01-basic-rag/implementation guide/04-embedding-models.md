# Chapter 4 — Vector Embedding Models

Embedding models convert textual concepts into high-dimensional numerical vector arrays ($ \mathbb{R}^d $). Words or paragraphs with similar semantic meanings map to nearby coordinates in vector space.

```text
"How does authentication work?" ───> [0.021, -0.184, 0.723, ..., 0.051]
```

In this chapter, we implement:
1. `src/embeddings/base.ts` — `EmbeddingModel` interface.
2. `src/embeddings/mock.ts` — `MockEmbeddingModel` (Zero-dependency, deterministic vectorizer for offline testing).
3. `src/embeddings/openai.ts` — `OpenAIEmbeddingModel`.
4. `src/embeddings/gemini.ts` — `GeminiEmbeddingModel`.

---

## 1. Embedding Model Interface (`src/embeddings/base.ts`)

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

## 2. Deterministic Mock Embedder (`src/embeddings/mock.ts`)

To allow instant testing without requiring an API key or internet access, we implement a deterministic `MockEmbeddingModel`. It hashes text tokens into fixed vector dimensions and applies $ L_2 $ normalization:

$$ \mathbf{v}_{\text{norm}} = \frac{\mathbf{v}}{\|\mathbf{v}\|_2} $$

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

---

## 3. OpenAI Embedding Adapter (`src/embeddings/openai.ts`)

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

---

## 4. Google Gemini Embedding Adapter (`src/embeddings/gemini.ts`)

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
