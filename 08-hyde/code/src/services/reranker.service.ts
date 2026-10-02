import { embeddingService } from './embedding.service';
import { MergedCandidateChunk } from '../types';

export class RerankerService {
  /**
   * Reranks merged retrieved candidates against the ORIGINAL user query (or joint prompt) using semantic cross-relevance.
   */
  async rerankCandidates(
    originalQuery: string,
    candidates: MergedCandidateChunk[],
    finalTopK: number = 5
  ): Promise<MergedCandidateChunk[]> {
    if (candidates.length === 0) return [];
    if (candidates.length === 1) return candidates;

    const queryEmbedding = await embeddingService.getEmbedding(originalQuery);
    const queryTokens = this.tokenize(originalQuery);

    const scoredCandidates = candidates.map((candidate) => {
      // 1. Semantic Embedding Similarity against Original Query
      let semanticScore = 0;
      if (candidate.chunk.embedding && queryEmbedding.length > 0) {
        semanticScore = embeddingService.cosineSimilarity(queryEmbedding, candidate.chunk.embedding);
      }

      // 2. Lexical keyword overlap score
      const chunkText = (candidate.chunk.content + ' ' + (candidate.chunk.metadata.title || '')).toLowerCase();
      let matchCount = 0;
      for (const t of queryTokens) {
        if (chunkText.includes(t)) matchCount++;
      }
      const lexicalScore = queryTokens.length > 0 ? matchCount / queryTokens.length : 0;

      // 3. Multiperspective bonus (reward chunks retrieved across multiple hypothetical docs / methods)
      const occurrenceBonus = Math.min(0.25, (candidate.occurrences - 1) * 0.1);

      // Weighted cross-encoder proxy score computation
      const rerankScore = semanticScore * 0.55 + lexicalScore * 0.25 + candidate.finalScore * 0.1 + occurrenceBonus;

      return {
        ...candidate,
        finalScore: Number(rerankScore.toFixed(4)),
      };
    });

    // Sort descending by rerankScore
    scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);

    return scoredCandidates.slice(0, finalTopK);
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
