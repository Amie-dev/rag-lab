import {
  DocumentChunk,
  FusionStrategy,
  MergedCandidateChunk,
  QueryVariation,
  SingleQueryRetrievalResult,
} from '../types';
import { vectorStoreService } from './vector-store.service';

export class ResultMergerService {
  /**
   * Executes independent retrieval for each query variation against the vector store,
   * then merges, deduplicates, and calculates fusion scores.
   */
  async retrieveAndMerge(
    queries: QueryVariation[],
    topKPerQuery: number = 5,
    retrievalMode: 'vector' | 'bm25' | 'hybrid' = 'hybrid',
    fusionStrategy: FusionStrategy = 'rrf'
  ): Promise<{
    singleQueryResults: SingleQueryRetrievalResult[];
    totalCandidatesRetrieved: number;
    uniqueCandidatesDeduplicated: number;
    mergedCandidates: MergedCandidateChunk[];
  }> {
    const singleQueryResults: SingleQueryRetrievalResult[] = [];
    let totalCandidatesRetrieved = 0;

    // 1. Run independent retrieval for each generated query
    for (const q of queries) {
      const results = await vectorStoreService.search(q.text, topKPerQuery, retrievalMode);
      totalCandidatesRetrieved += results.length;
      singleQueryResults.push({
        query: q.text,
        queryId: q.queryId,
        results,
      });
    }

    // 2. Merge, deduplicate, and calculate fusion scores
    const mergedCandidates = this.mergeAndDeduplicate(singleQueryResults, fusionStrategy);

    return {
      singleQueryResults,
      totalCandidatesRetrieved,
      uniqueCandidatesDeduplicated: mergedCandidates.length,
      mergedCandidates,
    };
  }

  /**
   * Merges retrieval result lists from multiple queries, deduplicates by chunk ID,
   * and computes attribution metadata & score fusion metrics.
   */
  mergeAndDeduplicate(
    retrievalResults: SingleQueryRetrievalResult[],
    fusionStrategy: FusionStrategy = 'rrf',
    rrfKConstant: number = 60
  ): MergedCandidateChunk[] {
    const candidateMap = new Map<
      string,
      {
        chunk: DocumentChunk;
        retrievedByQueries: string[];
        scoresPerQuery: Record<string, number>;
        ranksPerQuery: Record<string, number>;
      }
    >();

    // Process each query's ranked retrieval list
    for (const resList of retrievalResults) {
      const qId = resList.queryId;

      resList.results.forEach((item, index) => {
        const chunkId = item.chunk.id;
        const rank = index + 1; // 1-based rank
        const score = item.score;

        let existing = candidateMap.get(chunkId);
        if (!existing) {
          existing = {
            chunk: item.chunk,
            retrievedByQueries: [],
            scoresPerQuery: {},
            ranksPerQuery: {},
          };
          candidateMap.set(chunkId, existing);
        }

        if (!existing.retrievedByQueries.includes(qId)) {
          existing.retrievedByQueries.push(qId);
        }
        existing.scoresPerQuery[qId] = score;
        existing.ranksPerQuery[qId] = rank;
      });
    }

    // Calculate aggregated metrics & fusion scores
    const merged: MergedCandidateChunk[] = [];

    for (const [_, data] of candidateMap.entries()) {
      const scores = Object.values(data.scoresPerQuery);
      const occurrences = data.retrievedByQueries.length;
      const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      // Calculate RRF Score across all queries
      let rrfScore = 0;
      for (const [qId, rank] of Object.entries(data.ranksPerQuery)) {
        rrfScore += 1 / (rrfKConstant + rank);
      }

      // Determine final sorting score based on chosen strategy
      let finalScore = rrfScore;
      if (fusionStrategy === 'max_score') {
        finalScore = maxScore;
      } else if (fusionStrategy === 'avg_score') {
        finalScore = avgScore;
      }

      merged.push({
        chunk: data.chunk,
        occurrences,
        retrievedByQueries: data.retrievedByQueries,
        scoresPerQuery: data.scoresPerQuery,
        ranksPerQuery: data.ranksPerQuery,
        maxScore,
        avgScore,
        rrfScore,
        finalScore,
      });
    }

    // Sort descending by finalScore (primary) and occurrence count (secondary tie-breaker)
    return merged.sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      return b.occurrences - a.occurrences;
    });
  }
}

export const resultMergerService = new ResultMergerService();
