# 📦 Chapter 3 — Pre-Filtering & Post-Filtering Vector Store

Welcome to Chapter 3 of the **Metadata-Filtered RAG Implementation Guide**. In this chapter, we explore the implementation of `MemoryVectorStore`, distance metrics, and the algorithmic execution of **Pre-Filtering Search** versus **Post-Filtering Search**.

Source code modules:
- [`05-metadata-filtering/code/src/vectordb/distance.ts`](../code/src/vectordb/distance.ts)
- [`05-metadata-filtering/code/src/vectordb/memoryVectorStore.ts`](../code/src/vectordb/memoryVectorStore.ts)

---

## 1. Vector Distance Metrics

File: [`05-metadata-filtering/code/src/vectordb/distance.ts`](../code/src/vectordb/distance.ts)

```typescript
export class DistanceMetrics {
  /**
   * Cosine Similarity [-1.0, 1.0]. Higher is more similar.
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Euclidean Distance. Lower is more similar.
   */
  public static euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}
```

---

## 2. Pre-Filtering Search Implementation

In `searchPreFiltered`, every record in the store is first checked against `FilterEvaluator.evaluate(record.metadata, filter)`. Vector distance calculation occurs **only** for records that pass the filter.

File: [`05-metadata-filtering/code/src/vectordb/memoryVectorStore.ts`](../code/src/vectordb/memoryVectorStore.ts)

```typescript
  /**
   * 1️⃣ Pre-Filtering Retrieval
   * Filter constraint applied BEFORE vector distance calculation.
   * Only documents passing the metadata filter are evaluated and ranked.
   */
  public searchPreFiltered(
    queryVector: number[],
    filter?: MetadataFilter,
    topK: number = 5
  ): {
    results: RetrievalResult[];
    candidatesEvaluated: number;
    mode: SearchMode;
  } {
    const validCandidates: Array<{ record: VectorRecord; score: number }> = [];
    let candidatesEvaluated = 0;

    for (const record of this.records.values()) {
      // Step 1: Pre-filter evaluation
      const passesFilter = FilterEvaluator.evaluate(record.metadata, filter);
      if (!passesFilter) {
        continue;
      }

      // Step 2: Distance calculation on valid candidate
      candidatesEvaluated++;
      const score = DistanceMetrics.cosineSimilarity(queryVector, record.vector);

      validCandidates.push({ record, score });
    }

    // Step 3: Sort by cosine similarity descending
    validCandidates.sort((a, b) => b.score - a.score);

    const topResults = validCandidates.slice(0, topK).map((item) => ({
      chunk: item.record.chunk,
      score: item.score,
      recordId: item.record.id,
      metadataMatch: true,
    }));

    return {
      results: topResults,
      candidatesEvaluated,
      mode: 'pre-filter',
    };
  }
```

---

## 3. Post-Filtering Search Implementation

In `searchPostFiltered`, global vector similarity is calculated across **all** unpartitioned records in the index to select the global Top-$N$ candidate vectors. The metadata filter predicate is then applied to those Top-$N$ candidates.

```typescript
  /**
   * 2️⃣ Post-Filtering Retrieval
   * Global vector similarity search performed first across global index to get Top-N candidates.
   * Metadata filter is then applied AFTER global vector search.
   */
  public searchPostFiltered(
    queryVector: number[],
    filter?: MetadataFilter,
    topK: number = 5,
    globalCandidateLimit: number = 10
  ): {
    results: RetrievalResult[];
    candidatesEvaluated: number;
    mode: SearchMode;
  } {
    const globalScoredRecords: Array<{ record: VectorRecord; score: number }> = [];

    // Step 1: Compute vector similarity for ALL records globally
    for (const record of this.records.values()) {
      const score = DistanceMetrics.cosineSimilarity(queryVector, record.vector);
      globalScoredRecords.push({ record, score });
    }

    // Sort globally by score descending
    globalScoredRecords.sort((a, b) => b.score - a.score);

    // Step 2: Take top-N global vector candidates
    const topGlobalCandidates = globalScoredRecords.slice(0, globalCandidateLimit);

    // Step 3: Apply post-filtering onto global top-N candidates
    const filteredResults: RetrievalResult[] = [];
    for (const item of topGlobalCandidates) {
      const passesFilter = FilterEvaluator.evaluate(item.record.metadata, filter);

      if (passesFilter) {
        filteredResults.push({
          chunk: item.record.chunk,
          score: item.score,
          recordId: item.record.id,
          metadataMatch: true,
        });

        if (filteredResults.length >= topK) {
          break;
        }
      }
    }

    return {
      results: filteredResults,
      candidatesEvaluated: topGlobalCandidates.length,
      mode: 'post-filter',
    };
  }
```

---

## 4. Execution Flow Comparison

```text
Pre-Filtering Flow:
Index Records (10,000) ──> [Filter Predicate] ──> Valid Subset (50) ──> [Vector Distance] ──> Top-K Results (5)

Post-Filtering Flow:
Index Records (10,000) ──> [Vector Distance] ──> Global Top-N (10) ──> [Filter Predicate] ──> Remaining Results (0 to 5)
```
