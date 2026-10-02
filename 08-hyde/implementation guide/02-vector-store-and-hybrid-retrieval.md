# Chapter 2 — Vector Store & Hybrid Retrieval Subsystem

## ⚡ 1. Dual-Engine Dense Vector Embedding Service

The `EmbeddingService` ([`src/services/embedding.service.ts`](../code/src/services/embedding.service.ts)) generates 1536-dimensional L2-normalized dense vector embeddings. It operates in two modes:

1. **Production Mode**: Calls OpenAI `text-embedding-3-small` API.
2. **Local Fallback Mode**: Uses a deterministic character n-gram and sub-word hash projection algorithm to generate L2-normalized vectors without external network calls.

```typescript
import OpenAI from 'openai';
import { config } from '../config/environment';

export class EmbeddingService {
  private openai: OpenAI | null = null;
  private readonly dimension = 1536;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (this.openai && config.openaiApiKey) {
      try {
        const response = await this.openai.embeddings.create({
          model: config.openaiEmbeddingModel,
          input: text.replace(/\n/g, ' '),
        });
        return response.data[0].embedding;
      } catch (error) {
        console.warn('OpenAI API call failed, falling back to local deterministic embedding algorithm:', error);
      }
    }
    return this.generateLocalDeterministicEmbedding(text);
  }

  /**
   * Deterministic local embedding generator based on sub-word token hashing and character n-gram projections.
   * Produces L2-normalized 1536D dense vectors with semantic overlap properties.
   */
  private generateLocalDeterministicEmbedding(text: string): number[] {
    const vector = new Array(this.dimension).fill(0);
    const normalizedText = text.toLowerCase().trim();
    const tokens = normalizedText.split(/\W+/).filter(Boolean);

    for (const token of tokens) {
      const hash = this.hashString(token);
      const index = Math.abs(hash) % this.dimension;
      const val = hash % 2 === 0 ? 1.0 : -1.0;
      vector[index] += val;

      // 3-gram feature projections for partial sub-word semantic overlap
      for (let i = 0; i <= token.length - 3; i++) {
        const trigram = token.slice(i, i + 3);
        const triHash = this.hashString(trigram);
        const triIndex = Math.abs(triHash) % this.dimension;
        vector[triIndex] += triHash % 2 === 0 ? 0.5 : -0.5;
      }
    }

    // L2 Normalization
    let sumSquares = 0;
    for (let i = 0; i < this.dimension; i++) sumSquares += vector[i] * vector[i];
    const norm = Math.sqrt(sumSquares);

    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) vector[i] /= norm;
    }

    return vector;
  }

  private hashString(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  }

  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

export const embeddingService = new EmbeddingService();
```

---

## 🏬 2. In-Memory Vector Store & Text Chunker Subsystem

The `VectorStoreService` ([`src/services/vector-store.service.ts`](../code/src/services/vector-store.service.ts)) ingests raw documents, breaks them into overlapping chunks using a boundary-aware sliding window, and indexes their vector embeddings.

```typescript
export class VectorStoreService {
  private chunks: DocumentChunk[] = [];
  private isInitialized = false;

  async ingestDocuments(docs: Document[], chunkSize = 300, chunkOverlap = 50): Promise<number> {
    const newChunks: DocumentChunk[] = [];

    for (const doc of docs) {
      const textChunks = this.chunkText(doc.content, chunkSize, chunkOverlap);
      textChunks.forEach((chunkText, i) => {
        newChunks.push({
          id: `${doc.id}_chunk_${i + 1}`,
          documentId: doc.id,
          content: chunkText,
          chunkIndex: i,
          totalChunks: textChunks.length,
          metadata: doc.metadata || {},
        });
      });
    }

    // Batch compute embeddings
    const texts = newChunks.map((c) => c.content + ' ' + (c.metadata.title || ''));
    const embeddings = await embeddingService.getBatchEmbeddings(texts);

    newChunks.forEach((c, i) => (c.embedding = embeddings[i]));
    this.chunks = [...this.chunks, ...newChunks];
    this.isInitialized = true;

    return newChunks.length;
  }

  searchByVector(vector: number[], topK = 5, methodLabel: 'hyde_vector' | 'direct_vector' = 'hyde_vector'): SearchHit[] {
    const hits: SearchHit[] = [];

    for (const chunk of this.chunks) {
      if (!chunk.embedding) continue;
      const similarity = embeddingService.cosineSimilarity(vector, chunk.embedding);
      hits.push({ chunk, score: similarity, searchMethod: methodLabel });
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, topK);
  }

  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (cleanText.length <= chunkSize) return [cleanText];

    const chunks: string[] = [];
    let start = 0;

    while (start < cleanText.length) {
      let end = start + chunkSize;
      if (end < cleanText.length) {
        const lastPeriod = cleanText.lastIndexOf('. ', end);
        if (lastPeriod > start + chunkSize / 2) end = lastPeriod + 1;
        else {
          const lastSpace = cleanText.lastIndexOf(' ', end);
          if (lastSpace > start) end = lastSpace;
        }
      }

      chunks.push(cleanText.slice(start, end).trim());
      start = end - overlap;
      if (start >= cleanText.length || end >= cleanText.length) break;
    }

    return chunks;
  }
}

export const vectorStoreService = new VectorStoreService();
```

---

## 🔍 3. Okapi BM25 Lexical Sparse Search

The `BM25Service` ([`src/services/bm25.service.ts`](../code/src/services/bm25.service.ts)) implements exact lexical keyword matching to complement dense vector retrieval during hybrid search.

### Okapi BM25 Scoring Formula

$$\text{BM25Score}(D, Q) = \sum_{q \in Q} \text{IDF}(q) \cdot \frac{f(q, D) \cdot (k_1 + 1)}{f(q, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$

$$\text{IDF}(q) = \ln \left( 1 + \frac{N - n(q) + 0.5}{n(q) + 0.5} \right)$$

Where:
- $k_1 = 1.2$: Term frequency saturation parameter.
- $b = 0.75$: Document length normalization penalty parameter.
- $|D|$: Document chunk length in tokens.
- $\text{avgdl}$: Average document length across the collection.
- $N$: Total number of document chunks.
- $n(q)$: Number of chunks containing query term $q$.

Next, proceed to **[Chapter 3 — HyDE Generator Subsystem](./03-hyde-generator-subsystem.md)**.
