# Chapter 4 — Result Fusion & Deduplication Engine

## 🔀 Subsystem Overview & Code Implementation

The `ResultMergerService` ([`src/services/result-merger.service.ts`](../code/src/services/result-merger.service.ts)) executes parallel retrieval across multiple hypothetical documents (plus optional direct query search & BM25 sparse search), then fuses and deduplicates the candidate pool.

```typescript
import { FusionStrategy, HypotheticalDocument, MergedCandidateChunk, RetrievalMode, SearchHit } from '../types';
import { bm25Service } from './bm25.service';
import { embeddingService } from './embedding.service';
import { vectorStoreService } from './vector-store.service';

export interface MergeResult {
  mergedCandidates: MergedCandidateChunk[];
  totalCandidatesRetrieved: number;
  uniqueCandidatesDeduplicated: number;
}

export class ResultMergerService {
  private rrfK = 60; // Standard Reciprocal Rank Fusion constant

  async retrieveAndMerge(
    hypotheticalDocs: HypotheticalDocument[],
    originalQuery: string,
    topKPerDoc = 5,
    retrievalMode: RetrievalMode = 'hybrid',
    fusionStrategy: FusionStrategy = 'rrf',
    includeDirectQuerySearch = false
  ): Promise<MergeResult> {
    const allSearchHits: SearchHit[] = [];

    // 1. Vector retrieval per Hypothetical Document
    for (const hydeDoc of hypotheticalDocs) {
      let docVector = hydeDoc.embedding;
      if (!docVector || docVector.length === 0) {
        docVector = await embeddingService.getEmbedding(hydeDoc.hypotheticalText);
        hydeDoc.embedding = docVector;
      }

      const hits = vectorStoreService.searchByVector(docVector, topKPerDoc, 'hyde_vector');
      for (const h of hits) {
        allSearchHits.push({ ...h, hypotheticalDocId: hydeDoc.id });
      }
    }

    // 2. Direct Query Vector retrieval (if enabled)
    if (includeDirectQuerySearch) {
      const queryHits = await vectorStoreService.searchByText(originalQuery, topKPerDoc, 'direct_vector');
      for (const h of queryHits) allSearchHits.push(h);
    }

    // 3. BM25 Sparse Search (if hybrid mode enabled)
    if (retrievalMode === 'hybrid') {
      const allChunks = vectorStoreService.getChunks();
      const bm25Hits = bm25Service.search(originalQuery, allChunks, topKPerDoc);
      for (const h of bm25Hits) allSearchHits.push(h);
    }

    const totalRetrieved = allSearchHits.length;

    // 4. Group search hits by Chunk ID
    const chunkMap = new Map<string, SearchHit[]>();
    for (const hit of allSearchHits) {
      const chunkId = hit.chunk.id;
      if (!chunkMap.has(chunkId)) chunkMap.set(chunkId, []);
      chunkMap.get(chunkId)!.push(hit);
    }

    // 5. Apply Fusion Strategy
    const mergedCandidates: MergedCandidateChunk[] = [];

    for (const [chunkId, hits] of chunkMap.entries()) {
      const firstHit = hits[0];
      const occurrences = hits.length;

      const retrievedByMethods = Array.from(new Set(hits.map((h) => h.searchMethod)));
      const hypotheticalDocsUsed = Array.from(
        new Set(hits.map((h) => h.hypotheticalDocId).filter((id): id is string => Boolean(id)))
      );

      let finalScore = 0;
      let rrfScore = 0;

      if (fusionStrategy === 'rrf') {
        // Reciprocal Rank Fusion calculation
        for (const hit of hits) {
          const rank = hits.indexOf(hit) + 1;
          rrfScore += 1.0 / (this.rrfK + rank);
        }
        finalScore = rrfScore;
      } else if (fusionStrategy === 'score_weighted') {
        let sum = 0;
        for (const hit of hits) {
          const weight = hit.searchMethod === 'hyde_vector' ? 1.0 : hit.searchMethod === 'direct_vector' ? 0.8 : 0.6;
          sum += hit.score * weight;
        }
        finalScore = sum / hits.length;
      } else {
        // max_score
        finalScore = Math.max(...hits.map((h) => h.score));
      }

      mergedCandidates.push({
        chunk: firstHit.chunk,
        finalScore: Number(finalScore.toFixed(5)),
        rrfScore: rrfScore > 0 ? Number(rrfScore.toFixed(5)) : undefined,
        occurrences,
        retrievedByMethods,
        hypotheticalDocsUsed,
      });
    }

    // Sort descending by merged score
    mergedCandidates.sort((a, b) => b.finalScore - a.finalScore);

    return {
      mergedCandidates,
      totalCandidatesRetrieved: totalRetrieved,
      uniqueCandidatesDeduplicated: mergedCandidates.length,
    };
  }
}

export const resultMergerService = new ResultMergerService();
```

---

## 📊 Fusion Strategy Comparison

$$\text{RRF Score}(d) = \sum_{m \in M} \frac{1}{k + \text{rank}_m(d)}$$

| Strategy | Math Basis | Strength | Use Case |
| :--- | :--- | :--- | :--- |
| **Reciprocal Rank Fusion (RRF)** | Rank reciprocal sum ($k=60$) | Robust to raw score scale differences | Multi-HyDE + Hybrid BM25 fusion |
| **Score-Weighted** | Weighted arithmetic mean | Preserves raw cosine & BM25 confidence | Fine-tuned vector stores |
| **Max-Score** | Peak single score selection | Rewards top single-source match | Sparse datasets |

Next, proceed to **[Chapter 5 — Cross-Encoder Reranker & Grounded LLM Synthesizer](./05-cross-encoder-reranker-and-llm-synthesizer.md)**.
