# Chapter 2 — Vector Store & Hybrid Retrieval Subsystem

## 📦 In-Memory Vector Store

Located in [`code/src/services/vector-store.service.ts`](../code/src/services/vector-store.service.ts), `VectorStoreService` provides dense vector indexing, BM25 keyword search, and hybrid retrieval.

---

## ⚡ Dense Vector Search

Dense vector search relies on Cosine Similarity:

$$\text{Sim}(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2}$$

Implemented in [`code/src/services/embedding.service.ts`](../code/src/services/embedding.service.ts):

```typescript
cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
```

---

## 🔤 Okapi BM25 Lexical Search

Implemented in [`code/src/services/bm25.service.ts`](../code/src/services/bm25.service.ts):

$$\text{Score}(D, Q) = \sum_{q \in Q} \text{IDF}(q) \cdot \frac{f(q, D) \cdot (k_1 + 1)}{f(q, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$

---

## 🔀 Hybrid RRF Search Implementation

Combines Dense Vector and BM25 results:

```typescript
async hybridSearch(query: string, topK: number = 5): Promise<ScoredChunk[]> {
  const vectorResults = await this.vectorSearch(query, topK * 2);
  const bm25Results = this.bm25Search(query, topK * 2);

  const rrfMap = new Map<string, { chunk: DocumentChunk; score: number }>();
  const k = 60;

  vectorResults.forEach((res, rank) => {
    const rrfScore = 1 / (k + (rank + 1));
    const existing = rrfMap.get(res.chunk.id);
    if (existing) existing.score += rrfScore;
    else rrfMap.set(res.chunk.id, { chunk: res.chunk, score: rrfScore });
  });

  bm25Results.forEach((res, rank) => {
    const rrfScore = 1 / (k + (rank + 1));
    const existing = rrfMap.get(res.chunk.id);
    if (existing) existing.score += rrfScore;
    else rrfMap.set(res.chunk.id, { chunk: res.chunk, score: rrfScore });
  });

  return Array.from(rrfMap.values())
    .map((item) => ({ chunk: item.chunk, score: item.score, retrievalType: 'hybrid' as const }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
```

In the next chapter, we will build the Multi-Query Generator subsystem.
