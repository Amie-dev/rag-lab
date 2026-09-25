# 🔍 Chapter 2 — Stage 1: Candidate Retrieval & Vector Store

Welcome to Chapter 2 of the **Reranking RAG Implementation Guide**. In this chapter, we implement Stage 1 Candidate Retrieval: Dense Vector Search, Okapi BM25 Lexical Keyword Search, and Hybrid Search using Reciprocal Rank Fusion (RRF).

All corresponding code is located in [`06-reranking/code`](../code).

---

## 1. Dense Vector Similarity Search (Bi-Encoder)

Dense vector search measures the cosine similarity between the L2-normalized query embedding $\vec{q}$ and document embedding $\vec{v}_i$:

$$\text{Sim}_{\text{cosine}}(\vec{q}, \vec{v}_i) = \frac{\vec{q} \cdot \vec{v}_i}{\|\vec{q}\| \|\vec{v}_i\|}$$

```typescript
private cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

---

## 2. Okapi BM25 Lexical Keyword Search (`src/services/bm25.service.ts`)

Sparse lexical search uses the Okapi BM25 ranking algorithm:

$$\text{Score}_{\text{BM25}}(D, Q) = \sum_{i=1}^{n} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$

where:
$$\text{IDF}(q_i) = \ln \left( \frac{N - n(q_i) + 0.5}{n(q_i) + 0.5} + 1 \right)$$

### BM25 Implementation
```typescript
export class BM25Service {
  private k1 = 1.2;
  private b = 0.75;

  public tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter((t) => t.length > 1);
  }

  public scoreDocuments(query: string, documents: DocumentChunk[]): Map<string, number> {
    const scores = new Map<string, number>();
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || documents.length === 0) return scores;

    // ... Calculate TF, IDF, and document length normalization
    return scores;
  }
}
```

---

## 3. Hybrid Retrieval via Reciprocal Rank Fusion (RRF)

To maximize candidate recall in Stage 1, we combine Dense Vector search results and Sparse BM25 search results using **Reciprocal Rank Fusion (RRF)**:

$$\text{RRF Score}(d) = (1 - \alpha) \cdot \frac{1}{k + r_{\text{dense}}(d)} + \alpha \cdot \frac{1}{k + r_{\text{sparse}}(d)}$$

where $k = 60$ is the RRF smoothing constant and $\alpha = 0.5$ balances vector vs keyword influence.

```typescript
public searchHybrid(
  queryText: string,
  queryEmbedding: number[],
  topN: number,
  alpha = 0.5,
  rrfK = 60
): SearchCandidate[] {
  const denseCandidates = this.searchVector(queryEmbedding, topN * 2);
  const sparseCandidates = this.searchBM25(queryText, topN * 2);

  const rrfMap = new Map<string, { chunk: DocumentChunk; rrfScore: number }>();

  denseCandidates.forEach((cand) => {
    const existing = rrfMap.get(cand.chunk.id) || { chunk: cand.chunk, rrfScore: 0 };
    existing.rrfScore += (1 - alpha) * (1 / (rrfK + cand.stage1Rank));
    rrfMap.set(cand.chunk.id, existing);
  });

  sparseCandidates.forEach((cand) => {
    const existing = rrfMap.get(cand.chunk.id) || { chunk: cand.chunk, rrfScore: 0 };
    existing.rrfScore += alpha * (1 / (rrfK + cand.stage1Rank));
    rrfMap.set(cand.chunk.id, existing);
  });

  const merged = Array.from(rrfMap.values());
  merged.sort((a, b) => b.rrfScore - a.rrfScore);

  return merged.slice(0, topN).map((item, idx) => ({
    chunk: item.chunk,
    stage1Score: item.rrfScore,
    stage1Rank: idx + 1,
    retrievalMethod: 'hybrid',
  }));
}
```

In Chapter 3, we build Stage 2: Cross-Encoder Reranking Subsystem.
