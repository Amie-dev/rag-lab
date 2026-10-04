# Chapter 3 — Child Retrieval, BM25 & Fusion

Retrieval happens at the **child** level, and it happens **twice**: once with dense vectors, once with a sparse lexical model (BM25). This chapter builds both passes and fuses them into one ranked candidate list.

```text
Query ──┬──► EmbeddingService ──► ChildVectorStoreService ──► dense hits (child_dense) ──┐
        │                                                                                 ├──► ResultMergerService ──► fused children
        └──► BM25Service (lexical) ────────────────────────────► sparse hits (child_bm25) ─┘
```

---

## 🔤 1. Okapi BM25 Sparse Search

File: [`src/services/bm25.service.ts`](../code/src/services/bm25.service.ts)

Dense vectors are excellent at *semantics* but weak on *exact tokens* — error codes, IDs, names, and legal phrasing. BM25 fills that gap by scoring exact term overlap.

### The BM25 Formula

$$\text{BM25}(D, Q) = \sum_{q \in Q} \text{IDF}(q) \cdot \frac{f(q, D)\,(k_1 + 1)}{f(q, D) + k_1\left(1 - b + b\,\frac{|D|}{\text{avgdl}}\right)}$$

$$\text{IDF}(q) = \ln\!\left(1 + \frac{N - n(q) + 0.5}{n(q) + 0.5}\right)$$

Where $f(q,D)$ is the term frequency of $q$ in document $D$, $|D|$ is $D$'s length, $\text{avgdl}$ is the average document length, $N$ is the number of documents, and $n(q)$ is the number of documents containing $q$. The parameters $k_1 = 1.2$ and $b = 0.75$ control term-frequency saturation and length normalization.

### The Implementation

```typescript
export class BM25Service {
  private k1: number = 1.2;
  private b: number = 0.75;

  search(query: string, children: ChildChunk[], topK: number = 10): ChildSearchHit[] {
    if (children.length === 0 || !query.trim()) return [];

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const numDocs = children.length;
    const docTokenCounts: Map<string, number> = new Map();
    const docTokenFreqs: Map<string, Map<string, number>> = new Map();
    let totalDocLength = 0;

    for (const child of children) {
      const tokens = this.tokenize(`${child.content} ${child.metadata.title || ''}`);
      docTokenCounts.set(child.id, tokens.length);
      totalDocLength += tokens.length;

      const freqs = new Map<string, number>();
      for (const t of tokens) freqs.set(t, (freqs.get(t) || 0) + 1);
      docTokenFreqs.set(child.id, freqs);
    }

    const avgDocLength = totalDocLength / numDocs || 1;

    // Document frequency (df) for each query token.
    const docFreqs: Map<string, number> = new Map();
    for (const qToken of queryTokens) {
      let count = 0;
      for (const child of children) {
        if (docTokenFreqs.get(child.id)?.has(qToken)) count++;
      }
      docFreqs.set(qToken, count);
    }
    // …scoring loop below…
  }
}
```

The index is built **on the fly** for each search (this is a lab-scale, in-memory implementation). Two structures are precomputed:

- `docTokenCounts` → $|D|$ per document; summed into $\text{avgdl}$.
- `docTokenFreqs` → the term-frequency map $f(q, D)$ per document.
- `docFreqs` → $n(q)$, the document frequency of each query term, used for IDF.

The scoring loop:

```typescript
const scored: Array<{ child: ChildChunk; score: number }> = [];

for (const child of children) {
  const docLen = docTokenCounts.get(child.id) || 0;
  const freqs = docTokenFreqs.get(child.id);
  let score = 0;

  for (const qToken of queryTokens) {
    const tf = freqs?.get(qToken) || 0;
    if (tf === 0) continue;

    const df = docFreqs.get(qToken) || 0;
    const idf = Math.log(1 + (numDocs - df + 0.5) / (df + 0.5));
    const numerator = tf * (this.k1 + 1);
    const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / avgDocLength));
    score += idf * (numerator / denominator);
  }

  if (score > 0) scored.push({ child, score });
}

scored.sort((a, b) => b.score - a.score);

return scored.slice(0, topK).map((entry, idx) => ({
  child: entry.child,
  score: entry.score,
  searchMethod: 'child_bm25' as const,
  rank: idx + 1,
}));
```

- **`if (tf === 0) continue`** skips terms the document doesn't contain — the inner loop only touches matching terms.
- **`if (score > 0)`** drops documents with zero overlap, so only real lexical matches are returned.
- The **`idf` uses the `log(1 + …)` form** which is always ≥ 0, avoiding negative IDF for very common terms.
- Tokenization strips punctuation and single characters:

```typescript
private tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}
```

---

## 🔀 2. Hybrid Retrieval & Score Fusion

File: [`src/services/result-merger.service.ts`](../code/src/services/result-merger.service.ts)

The merger runs the two retrieval passes and **fuses** their ranked lists into one deduplicated candidate pool.

```typescript
export interface MergeResult {
  mergedCandidates: MergedChildCandidate[];
  totalCandidatesRetrieved: number;
  uniqueCandidatesDeduplicated: number;
}

export class ResultMergerService {
  private rrfK: number = 60; // Standard Reciprocal Rank Fusion constant.

  retrieveChildren(
    queryVector: number[],
    query: string,
    childTopK: number = 10,
    retrievalMode: RetrievalMode = 'hybrid',
    fusionStrategy: FusionStrategy = 'rrf'
  ): MergeResult {
    const allHits: ChildSearchHit[] = [];

    // 1. Dense child vector retrieval.
    const denseHits = vectorStoreService.searchByVector(queryVector, childTopK);
    allHits.push(...denseHits);

    // 2. Sparse BM25 retrieval (hybrid mode only).
    if (retrievalMode === 'hybrid') {
      const children = vectorStoreService.getChildren();
      const sparseHits = bm25Service.search(query, children, childTopK);
      allHits.push(...sparseHits);
    }

    return this.fuseHits(allHits, fusionStrategy);
  }
```

- The **query is embedded once** upstream and passed in (see Chapter 7) — no re-embedding per pass.
- `retrievalMode = 'vector_only'` simply skips BM25, giving a clean ablation switch for benchmarks.

### The Three Fusion Strategies

```typescript
fuseHits(hits: ChildSearchHit[], fusionStrategy: FusionStrategy = 'rrf'): MergeResult {
  const totalCandidatesRetrieved = hits.length;

  // Group hits by child ID (dedupe across passes).
  const childMap: Map<string, ChildSearchHit[]> = new Map();
  for (const hit of hits) {
    if (!childMap.has(hit.child.id)) childMap.set(hit.child.id, []);
    childMap.get(hit.child.id)!.push(hit);
  }

  const mergedCandidates: MergedChildCandidate[] = [];

  for (const [, childHits] of childMap.entries()) {
    const firstHit = childHits[0];
    const occurrences = childHits.length;
    const retrievedByMethods = Array.from(new Set(childHits.map((h) => h.searchMethod)));

    let finalScore = 0;
    let rrfScore = 0;

    if (fusionStrategy === 'rrf') {
      for (const hit of childHits) rrfScore += 1.0 / (this.rrfK + hit.rank);
      finalScore = rrfScore;
    } else if (fusionStrategy === 'score_weighted') {
      let sum = 0;
      for (const hit of childHits) {
        const weight = hit.searchMethod === 'child_dense' ? 1.0 : 0.6;
        sum += hit.score * weight;
      }
      finalScore = sum / childHits.length;
    } else {
      finalScore = Math.max(...childHits.map((h) => h.score));   // max_score
    }

    mergedCandidates.push({
      child: firstHit.child,
      parentId: firstHit.child.parentId,
      finalScore: Number(finalScore.toFixed(5)),
      rrfScore: rrfScore > 0 ? Number(rrfScore.toFixed(5)) : undefined,
      occurrences,
      retrievedByMethods,
    });
  }

  mergedCandidates.sort((a, b) => b.finalScore - a.finalScore);

  return {
    mergedCandidates,
    totalCandidatesRetrieved,
    uniqueCandidatesDeduplicated: mergedCandidates.length,
  };
}
```

**Reciprocal Rank Fusion (RRF)** — the default — scores a child by summing $1/(k + \text{rank})$ across the passes it appears in:

$$\text{RRF}(c) = \sum_{r \in \text{rankings containing } c} \frac{1}{k + \text{rank}_r(c)}, \qquad k = 60$$

```text
A child ranked #1 in BOTH passes  → 1/61 + 1/61 ≈ 0.0328   (very strong)
A child ranked #1 in ONE pass     → 1/61        ≈ 0.0164
A child ranked #40 in one pass    → 1/100       ≈ 0.0100
```

Because RRF uses **rank**, not raw score, it is robust to the fact that cosine similarity (≈0…1) and BM25 (unbounded) live on different scales — no normalization needed.

- **`score_weighted`** blends raw scores with a dense-heavy weight (1.0 dense vs 0.6 sparse) and averages them.
- **`max_score`** simply keeps the best raw score for the child.
- **`occurrences`** and **`retrievedByMethods`** are preserved so the reranker can *reward* candidates found by multiple passes.

> ✅ **Deduplication happens here.** If the same child is hit by both dense and sparse retrieval, it becomes **one** candidate with `occurrences = 2` and `retrievedByMethods = ['child_dense','child_bm25']` — not two rows.

Next, proceed to **[Chapter 4 — Cross-Encoder Child Reranking](./04-cross-encoder-child-reranking.md)**.

