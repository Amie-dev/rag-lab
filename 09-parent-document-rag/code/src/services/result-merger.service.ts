import {
  ChildSearchHit,
  FusionStrategy,
  MergedChildCandidate,
  RetrievalMode,
} from '../types';
import { bm25Service } from './bm25.service';
import { vectorStoreService } from './vector-store.service';

export interface MergeResult {
  mergedCandidates: MergedChildCandidate[];
  totalCandidatesRetrieved: number;
  uniqueCandidatesDeduplicated: number;
}

/**
 * ResultMergerService fuses dense (child vector) and sparse (BM25) retrieval
 * passes over the child index into a single, deduplicated, ranked candidate
 * list before parent resolution.
 */
export class ResultMergerService {
  private rrfK: number = 60; // Standard Reciprocal Rank Fusion constant.

  /**
   * Runs the requested child retrieval passes and fuses the results.
   */
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

  /**
   * Fuses a flat list of search hits into deduplicated child candidates.
   */
  fuseHits(hits: ChildSearchHit[], fusionStrategy: FusionStrategy = 'rrf'): MergeResult {
    const totalCandidatesRetrieved = hits.length;

    // Group hits by child ID.
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
        for (const hit of childHits) {
          rrfScore += 1.0 / (this.rrfK + hit.rank);
        }
        finalScore = rrfScore;
      } else if (fusionStrategy === 'score_weighted') {
        let sum = 0;
        for (const hit of childHits) {
          const weight = hit.searchMethod === 'child_dense' ? 1.0 : 0.6;
          sum += hit.score * weight;
        }
        finalScore = sum / childHits.length;
      } else {
        // max_score
        finalScore = Math.max(...childHits.map((h) => h.score));
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
}

export const resultMergerService = new ResultMergerService();
