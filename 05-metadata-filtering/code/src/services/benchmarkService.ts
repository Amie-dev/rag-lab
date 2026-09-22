/**
 * Pre-Filtering vs Post-Filtering Benchmark Service Engine
 */

import { BenchmarkComparisonResultDTO, BenchmarkQueryDTO } from '../types/api.types.js';
import { RAGService } from './ragService.js';

export class BenchmarkService {
  private ragService: RAGService;

  constructor(ragService: RAGService) {
    this.ragService = ragService;
  }

  /**
   * Runs side-by-side benchmark comparing Pre-Filtering and Post-Filtering.
   */
  public async compareFilterPerformance(
    dto: BenchmarkQueryDTO
  ): Promise<BenchmarkComparisonResultDTO> {
    const topK = dto.topK || 5;
    const candidateLimits = dto.postFilterCandidateLimits || [5, 10, 20, 50];

    // 1. Run Pre-Filtering Ground Truth Execution
    const preResult = await this.ragService.search({
      query: dto.query,
      filter: dto.filter,
      topK,
      mode: 'pre-filter',
      bypassAuthGuard: true,
    });

    const groundTruthIds = new Set(preResult.results.map((r) => r.chunk.id));
    const preAvgScore =
      preResult.results.length > 0
        ? preResult.results.reduce((acc, r) => acc + r.score, 0) / preResult.results.length
        : 0;

    // 2. Run Post-Filtering across varying global candidate limits
    const postRuns = [];
    let totalWasteCandidates = 0;

    for (const limit of candidateLimits) {
      const postResult = await this.ragService.search({
        query: dto.query,
        filter: dto.filter,
        topK,
        mode: 'post-filter',
        postFilterCandidateLimit: limit,
        bypassAuthGuard: true,
      });

      const postIds = postResult.results.map((r) => r.chunk.id);

      // Compute Precision relative to ground-truth pre-filter results
      let matches = 0;
      for (const id of postIds) {
        if (groundTruthIds.has(id)) {
          matches++;
        }
      }

      const precision =
        groundTruthIds.size > 0 ? matches / Math.min(topK, groundTruthIds.size) : 1.0;

      const zeroResultOccurred = postResult.results.length === 0 && groundTruthIds.size > 0;

      totalWasteCandidates += Math.max(0, limit - postResult.results.length);

      postRuns.push({
        candidateLimit: limit,
        retrievedCount: postResult.results.length,
        candidatesEvaluated: postResult.candidatesEvaluated,
        latencyMs: postResult.latencyMs,
        precisionVersusPreFilter: parseFloat(precision.toFixed(2)),
        returnedChunkIds: postIds,
        zeroResultOccurred,
      });
    }

    const candidateWasteRatio = parseFloat(
      (totalWasteCandidates / Math.max(1, preResult.candidatesEvaluated * postRuns.length)).toFixed(2)
    );

    let recommendation =
      'Pre-filtering is recommended. It guarantees top-K retrieval within valid metadata constraints without candidate starvation.';
    if (postRuns.some((r) => r.zeroResultOccurred)) {
      recommendation =
        'CRITICAL: Post-filtering suffered zero-result starvation because restrictive filters excluded matching candidates from global top-N vectors. Use Pre-filtering for production isolation.';
    }

    return {
      query: dto.query,
      filter: dto.filter,
      topK,
      preFilter: {
        retrievedCount: preResult.results.length,
        candidatesEvaluated: preResult.candidatesEvaluated,
        latencyMs: preResult.latencyMs,
        avgScore: parseFloat(preAvgScore.toFixed(4)),
        returnedChunkIds: Array.from(groundTruthIds),
      },
      postFilterRuns: postRuns,
      analysis: {
        recommendation,
        candidateWasteRatio,
      },
    };
  }
}
