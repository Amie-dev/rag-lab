# ⚖️ Chapter 4 — Scoring Algorithms (TF-IDF & Okapi BM25)

Welcome to Chapter 4 of the **Keyword RAG Implementation Guide**. In this chapter, we explore the implementation of lexical scoring algorithms that calculate relevance weights between search queries and document chunks.

---

## 1. IDF Formulation Variants (`idf.ts`)

Located in [`03-keyword-rag/code/src/scoring/idf.ts`](../code/src/scoring/idf.ts):

### Okapi BM25 Robertson IDF
$$\text{IDF}_{\text{BM25}}(t) = \ln\left( \frac{N - n(t) + 0.5}{n(t) + 0.5} + 1 \right)$$

To prevent negative values when $n(t) > N/2$, `calculateBM25IDF` applies an $\epsilon$ floor (default $0.25$):

```typescript
export function calculateBM25IDF(docCount: number, docFreq: number, epsilon: number = 0.25): number {
  if (docCount === 0 || docFreq === 0) return 0;
  const rawIdf = Math.log((docCount - docFreq + 0.5) / (docFreq + 0.5) + 1.0);
  return rawIdf < 0 ? epsilon : Math.max(rawIdf, epsilon);
}
```

---

## 2. Okapi BM25 Scorer (`bm25.ts`)

Located in [`03-keyword-rag/code/src/scoring/bm25.ts`](../code/src/scoring/bm25.ts):

The `BM25Scorer` computes per-term and document-level relevance scores:

$$\text{LengthNorm} = 1 - b + b \cdot \left(\frac{|d|}{\text{avgdl}}\right)$$

$$\text{TFSaturation} = \frac{f(t, d) \cdot (k_1 + 1)}{f(t, d) + k_1 \cdot \text{LengthNorm}}$$

$$\text{BM25Score}(t, d) = \text{IDF}(t) \cdot \text{TFSaturation}$$

```typescript
export class BM25Scorer {
  private k1: number;
  private b: number;
  private epsilon: number;

  constructor(params: BM25Params = { k1: 1.5, b: 0.75, epsilon: 0.25 }) {
    this.k1 = params.k1;
    this.b = params.b;
    this.epsilon = params.epsilon ?? 0.25;
  }

  public scoreTerm(term: string, docId: string, index: InvertedIndex): TermScoreDetail {
    const posting = index.getPosting(term, docId);
    const rawTf = posting ? posting.termFrequency : 0;
    const N = index.getTotalDocuments();
    const df = index.getDocumentFrequency(term);
    const idf = calculateBM25IDF(N, df, this.epsilon);

    if (rawTf === 0 || idf === 0) {
      return { term, rawTf, idf, bm25Score: 0, tfidfScore: 0, scoreContribution: 0 };
    }

    const docLen = index.getDocLength(docId);
    const avgdl = index.getAvgDocLength();
    const lenNorm = avgdl > 0 ? 1 - this.b + this.b * (docLen / avgdl) : 1;
    const tfSat = (rawTf * (this.k1 + 1)) / (rawTf + this.k1 * lenNorm);
    const bm25Score = idf * tfSat;

    return { term, rawTf, idf, bm25Score, tfidfScore: 0, scoreContribution: bm25Score };
  }
}
```

---

## 3. TF-IDF Scorer (`tfidf.ts`)

Located in [`03-keyword-rag/code/src/scoring/tfidf.ts`](../code/src/scoring/tfidf.ts):

Supports sublinear term frequency scaling ($1 + \ln(TF)$) combined with smooth IDF ($1 + \ln(\frac{N+1}{n(t)+1})$):

$$\text{TF}_{\text{sublinear}} = 1 + \ln(f(t, d)) \quad \text{for } f(t, d) > 0$$

$$\text{Score}_{\text{TF-IDF}}(q, d) = \sum_{t \in q} \text{TF}_{\text{sublinear}}(t, d) \cdot \text{IDF}_{\text{smooth}}(t)$$

In Chapter 5, we look at how `KeywordSearchEngine` orchestrates these scorers across the postings lists during query execution.
