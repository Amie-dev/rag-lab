import { MergedChildCandidate } from '../types';
import { embeddingService } from './embedding.service';

/**
 * RerankerService reorders fused child candidates against the ORIGINAL user
 * query using a cross-encoder proxy: a blend of dense semantic relevance,
 * lexical overlap, fusion score, and multi-pass evidence.
 *
 * Reranking happens at the CHILD level (before parent resolution) so that the
 * most relevant children — and therefore the most relevant parents — survive
 * the final top-K truncation.
 */
export class RerankerService {
  async rerankChildCandidates(
    originalQuery: string,
    candidates: MergedChildCandidate[],
    finalChildTopK: number = 8
  ): Promise<MergedChildCandidate[]> {
    if (candidates.length === 0) return [];
    if (candidates.length === 1) return candidates.slice(0, finalChildTopK);

    const queryEmbedding = await embeddingService.getEmbedding(originalQuery);
    const queryTokens = this.tokenize(originalQuery);

    const scored = candidates.map((candidate) => {
      // 1. Semantic embedding similarity against the original query.
      let semanticScore = 0;
      if (candidate.child.embedding && queryEmbedding.length > 0) {
        semanticScore = embeddingService.cosineSimilarity(queryEmbedding, candidate.child.embedding);
      }

      // 2. Lexical keyword overlap score.
      const childText = `${candidate.child.content} ${candidate.child.metadata.title || ''}`.toLowerCase();
      let matchCount = 0;
      for (const t of queryTokens) {
        if (childText.includes(t)) matchCount++;
      }
      const lexicalScore = queryTokens.length > 0 ? matchCount / queryTokens.length : 0;

      // 3. Multi-pass evidence bonus (reward children surfaced by several passes).
      const occurrenceBonus = Math.min(0.2, (candidate.occurrences - 1) * 0.08);
      // 4. Small bonus for being found by both dense and sparse retrieval.
      const hybridBonus = candidate.retrievedByMethods.length > 1 ? 0.08 : 0;

      const rerankScore =
        semanticScore * 0.5 +
        lexicalScore * 0.25 +
        candidate.finalScore * 0.1 +
        occurrenceBonus +
        hybridBonus;

      return { ...candidate, finalScore: Number(rerankScore.toFixed(5)) };
    });

    scored.sort((a, b) => b.finalScore - a.finalScore);
    return scored.slice(0, finalChildTopK);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }
}

export const rerankerService = new RerankerService();
