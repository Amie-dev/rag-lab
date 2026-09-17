# Chapter 6 — Dense Vector Embedding Models

Embedding models transform unstructured text chunks and user queries into dense floating-point numeric vectors.

This chapter details the `EmbeddingModel` contract and the three supported providers: **Mock**, **OpenAI**, and **Google Gemini**.

Source code locations:
- [`src/embeddings/base.ts`](../code/src/embeddings/base.ts)
- [`src/embeddings/mock.ts`](../code/src/embeddings/mock.ts)
- [`src/embeddings/openai.ts`](../code/src/embeddings/openai.ts)
- [`src/embeddings/gemini.ts`](../code/src/embeddings/gemini.ts)

---

## 1. The EmbeddingModel Interface

All embedding model providers implement [`src/embeddings/base.ts`](../code/src/embeddings/base.ts):

```typescript
export interface EmbeddingModel {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
  dimension(): number;
}
```

---

## 2. Deterministic Mock Semantic Embedding Provider

To enable offline testing and demonstrations without requiring external API keys, `MockEmbeddingModel` projects text into a $128$-dimensional space using character trigram feature hashing and term frequency weighting, followed by $L_2$-normalization:

```typescript
import { EmbeddingModel } from './base';
import { VectorMath } from '../math/vectorMath';

export class MockEmbeddingModel implements EmbeddingModel {
  private dim: number;

  constructor(dimension: number = 128) {
    this.dim = dimension;
  }

  public async embedQuery(text: string): Promise<number[]> {
    return this.generateSemanticVector(text);
  }

  public async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.generateSemanticVector(t)));
  }

  public dimension(): number {
    return this.dim;
  }

  private generateSemanticVector(text: string): number[] {
    const rawVector = new Array(this.dim).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = cleaned.split(/\s+/).filter(Boolean);

    for (const word of words) {
      // Feature hash 1: word hash
      const hash1 = this.hashString(word);
      const idx1 = Math.abs(hash1) % this.dim;
      rawVector[idx1] += (hash1 % 2 === 0 ? 1 : -1) * 2.0;

      // Feature hash 2: character trigrams
      for (let i = 0; i < word.length - 2; i++) {
        const trigram = word.substring(i, i + 3);
        const hash2 = this.hashString(trigram);
        const idx2 = Math.abs(hash2) % this.dim;
        rawVector[idx2] += hash2 % 2 === 0 ? 0.5 : -0.5;
      }
    }

    return VectorMath.l2Normalize(rawVector);
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash;
  }
}
```

---

## 3. Production OpenAI & Gemini Embeddings

### OpenAI Embedding Provider ([`openai.ts`](../code/src/embeddings/openai.ts))
Connects to `https://api.openai.com/v1/embeddings` using `text-embedding-3-small` ($d = 1536$).

### Gemini Embedding Provider ([`gemini.ts`](../code/src/embeddings/gemini.ts))
Connects to Google Gemini API using `text-embedding-004` ($d = 768$).
