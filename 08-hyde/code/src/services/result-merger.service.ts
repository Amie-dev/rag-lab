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
  private rrfK: number = 60; // Standard Reciprocal Rank Fusion constant

  /**
   * Executes multi-source retrieval (HyDE vector + BM25 sparse) across hypothetical documents, then fuses & deduplicates results.
   */
  async retrieveAndMerge(
    hypotheticalDocs: HypotheticalDocument[],
    originalQuery: string,
    topKPerDoc: number = 5,
    retrievalMode: RetrievalMode = 'hybrid',
    fusionStrategy: FusionStrategy = 'rrf',
    includeDirectQuerySearch: boolean = false
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
        allSearchHits.push({
          ...h,
          hypotheticalDocId: hydeDoc.id,
        });
      }
    }

    // 2. Direct Query Vector retrieval (if requested)
    if (includeDirectQuerySearch) {
      const queryHits = await vectorStoreService.searchByText(originalQuery, topKPerDoc, 'direct_vector');
      for (const h of queryHits) {
        allSearchHits.push(h);
      }
    }

    // 3. BM25 Sparse Search (if hybrid retrieval enabled)
    if (retrievalMode === 'hybrid') {
      const allChunks = vectorStoreService.getChunks();
      const bm25Hits = bm25Service.search(originalQuery, allChunks, topKPerDoc);
      for (const h of bm25Hits) {
        allSearchHits.push(h);
      }
    }

    const totalRetrieved = allSearchHits.length;

    // 4. Group search hits by Chunk ID
    const chunkMap: Map<string, SearchHit[]> = new Map();
    for (const hit of allSearchHits) {
      const chunkId = hit.chunk.id;
      if (!chunkMap.has(chunkId)) {
        chunkMap.set(chunkId, []);
      }
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
          // Assume position index approximation based on hit ranking within hits list
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

    // Sort descending by merged final score
    mergedCandidates.sort((a, b) => b.finalScore - a.finalScore);

    return {
      mergedCandidates,
      totalCandidatesRetrieved: totalRetrieved,
      uniqueCandidatesDeduplicated: mergedCandidates.length,
    };
  }
}

export const resultMergerService = new ResultMergerService();
