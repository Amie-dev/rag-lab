import { BenchmarkRequest, BenchmarkSummaryResponse, BenchmarkComparisonResult } from '../types';
import { vectorStoreService } from './vector-store.service';
import { multiQueryRAGService } from './multi-query-rag.service';

export class BenchmarkService {
  private defaultTestQueries = [
    'How to handle session timeout and prevent unauthorized page access?',
    'What is our policy regarding subscription cancellations and refund windows?',
    'How do I configure database indexes to optimize slow executing queries?',
    'What steps are required to implement API rate limiting and token bucket algorithm?',
  ];

  /**
   * Executes comparative benchmark suite comparing Single-Query RAG vs Multi-Query RAG.
   */
  async runBenchmark(request: BenchmarkRequest): Promise<BenchmarkSummaryResponse> {
    const queries = request.queries && request.queries.length > 0 ? request.queries : this.defaultTestQueries;
    const numQueries = request.numQueries ?? 4;
    const topKPerQuery = request.topKPerQuery ?? 5;
    const finalTopK = request.finalTopK ?? 5;

    const results: BenchmarkComparisonResult[] = [];

    for (const q of queries) {
      // --- 1. Single Query Benchmark ---
      const startSingle = Date.now();
      const singleResults = await vectorStoreService.search(q, topKPerQuery, 'hybrid');
      const latencySingle = Date.now() - startSingle;
      const singleUniqueIds = Array.from(new Set(singleResults.map((r) => r.chunk.id)));

      // --- 2. Multi-Query Benchmark ---
      const startMulti = Date.now();
      const multiResponse = await multiQueryRAGService.search({
        query: q,
        numQueries,
        topKPerQuery,
        finalTopK,
        fusionStrategy: 'rrf',
        enableReranking: false,
        retrievalMode: 'hybrid',
      });
      const latencyMulti = Date.now() - startMulti;

      const multiUniqueIds = multiResponse.mergedResults.map((m) => m.chunk.id);
      const singleSet = new Set(singleUniqueIds);

      // Find new chunks discovered by Multi-Query that Single-Query missed
      const newChunksDiscovered = multiUniqueIds.filter((id) => !singleSet.has(id)).length;
      const singleCount = singleUniqueIds.length || 1;
      const recallGainPercent = parseFloat(((newChunksDiscovered / singleCount) * 100).toFixed(2));

      const deduplicationRatio = multiResponse.totalCandidatesRetrieved > 0
        ? parseFloat((multiResponse.uniqueCandidatesDeduplicated / multiResponse.totalCandidatesRetrieved).toFixed(3))
        : 1.0;

      results.push({
        query: q,
        singleQueryMetrics: {
          queryUsed: q,
          chunksRetrieved: singleResults.length,
          uniqueChunkIds: singleUniqueIds,
          latencyMs: latencySingle,
        },
        multiQueryMetrics: {
          generatedQueries: multiResponse.generatedQueries.map((g) => g.text),
          totalRetrieved: multiResponse.totalCandidatesRetrieved,
          uniqueChunkIds: multiUniqueIds,
          uniqueChunkCount: multiUniqueIds.length,
          newChunksDiscovered,
          recallGainPercent,
          deduplicationRatio,
          latencyMs: latencyMulti,
        },
      });
    }

    // Compute aggregates
    const count = results.length || 1;
    const avgSingleChunks = results.reduce((a, r) => a + r.singleQueryMetrics.chunksRetrieved, 0) / count;
    const avgMultiUnique = results.reduce((a, r) => a + r.multiQueryMetrics.uniqueChunkCount, 0) / count;
    const avgNewDiscovered = results.reduce((a, r) => a + r.multiQueryMetrics.newChunksDiscovered, 0) / count;
    const avgRecallGain = results.reduce((a, r) => a + r.multiQueryMetrics.recallGainPercent, 0) / count;
    const avgDedupRatio = results.reduce((a, r) => a + r.multiQueryMetrics.deduplicationRatio, 0) / count;
    const avgSingleLat = results.reduce((a, r) => a + r.singleQueryMetrics.latencyMs, 0) / count;
    const avgMultiLat = results.reduce((a, r) => a + r.multiQueryMetrics.latencyMs, 0) / count;

    return {
      testQueriesCount: results.length,
      results,
      averageMetrics: {
        avgSingleQueryChunks: parseFloat(avgSingleChunks.toFixed(2)),
        avgMultiQueryUniqueChunks: parseFloat(avgMultiUnique.toFixed(2)),
        avgNewChunksDiscovered: parseFloat(avgNewDiscovered.toFixed(2)),
        avgRecallGainPercent: parseFloat(avgRecallGain.toFixed(2)),
        avgDeduplicationRatio: parseFloat(avgDedupRatio.toFixed(3)),
        avgSingleQueryLatencyMs: parseFloat(avgSingleLat.toFixed(2)),
        avgMultiQueryLatencyMs: parseFloat(avgMultiLat.toFixed(2)),
      },
    };
  }
}

export const benchmarkService = new BenchmarkService();
