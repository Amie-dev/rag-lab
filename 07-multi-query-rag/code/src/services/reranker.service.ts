import { MergedCandidateChunk } from '../types';
import { embeddingService } from './embedding.service';

export class RerankerService {
  /**
   * Reranks deduplicated candidate chunks against the original user query
   * combining semantic similarity, occurrences boost, and keyword match boost.
   */
  async rerankCandidates(
    originalQuery: string,
    candidates: MergedCandidateChunk[],
    finalTopK: number = 5
  ): Promise<MergedCandidateChunk[]> {
    if (candidates.length <= 1) return candidates.slice(0, finalTopK);

    const queryEmbedding = await embeddingService.getEmbedding(originalQuery);
    const queryTokens = originalQuery.toLowerCase().split(/\W+/).filter((w) => w.length > 2);

    const rescored = await Promise.all(
      candidates.map(async (cand) => {
        let embeddingScore = cand.chunk.embedding
          ? embeddingService.cosineSimilarity(queryEmbedding, cand.chunk.embedding)
          : cand.maxScore;

        // Occurrence boost: candidates retrieved by multiple query perspectives get higher confidence boost
        const multiQueryBoost = 1 + (cand.occurrences - 1) * 0.15;

        // Keyword overlap boost
        const contentLower = (cand.chunk.content + ' ' + (cand.chunk.metadata.title || '')).toLowerCase();
        let matchCount = 0;
        for (const token of queryTokens) {
          if (contentLower.includes(token)) matchCount++;
        }
        const kwRatio = queryTokens.length > 0 ? matchCount / queryTokens.length : 0;

        const rerankScore = (embeddingScore * 0.5 + cand.finalScore * 0.3 + kwRatio * 0.2) * multiQueryBoost;

        return {
          ...cand,
          finalScore: rerankScore,
        };
      })
    );

    return rescored.sort((a, b) => b.finalScore - a.finalScore).slice(0, finalTopK);
  }
}

export const rerankerService = new RerankerService();
