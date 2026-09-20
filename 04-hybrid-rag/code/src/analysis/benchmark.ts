import { ComparativeBenchmarkResult, HybridConfig } from '../schemas';
import { HybridRAGPipeline } from '../pipeline/hybrid-pipeline';
import { RankCorrelationAnalyzer } from './rank-correlation';

export class HybridBenchmarkRunner {
  private pipeline: HybridRAGPipeline;

  constructor(pipeline: HybridRAGPipeline) {
    this.pipeline = pipeline;
  }

  async runQueryBenchmark(query: string, config?: HybridConfig): Promise<ComparativeBenchmarkResult> {
    const topK = config?.topK ?? 5;

    // 1. Run Dense Search
    const denseStart = Date.now();
    const denseResults = await this.pipeline.getDenseStore().search(query, topK);
    const denseLatency = Date.now() - denseStart;
    const denseItemIds = denseResults.map((r) => r.chunk.id);

    // 2. Run Sparse Search
    const sparseStart = Date.now();
    const sparseResults = this.pipeline.getSparseEngine().search(query, topK);
    const sparseLatency = Date.now() - sparseStart;
    const sparseItemIds = sparseResults.map((r) => r.chunk.id);

    // 3. Run Hybrid Search
    const hybridStart = Date.now();
    const hybridResults = await this.pipeline.search(query, { ...config, topK });
    const hybridLatency = Date.now() - hybridStart;
    const hybridItemIds = hybridResults.map((r) => r.chunk.id);

    // Calculate candidate overlap with Hybrid Top-K
    const denseOverlapCount = denseItemIds.filter((id) => hybridItemIds.includes(id)).length;
    const sparseOverlapCount = sparseItemIds.filter((id) => hybridItemIds.includes(id)).length;

    const rankCorrelation = RankCorrelationAnalyzer.analyze(denseItemIds, sparseItemIds);

    return {
      query,
      denseMetrics: {
        retrievalLatencyMs: denseLatency,
        candidateCount: denseResults.length,
        topItemIds: denseItemIds,
        overlapWithHybridPercent: topK > 0 ? (denseOverlapCount / topK) * 100 : 0
      },
      sparseMetrics: {
        retrievalLatencyMs: sparseLatency,
        candidateCount: sparseResults.length,
        topItemIds: sparseItemIds,
        overlapWithHybridPercent: topK > 0 ? (sparseOverlapCount / topK) * 100 : 0
      },
      hybridMetrics: {
        retrievalLatencyMs: hybridLatency,
        candidateCount: hybridResults.length,
        topItemIds: hybridItemIds
      },
      rankCorrelation
    };
  }

  static formatBenchmarkReport(result: ComparativeBenchmarkResult): string {
    const { query, denseMetrics, sparseMetrics, hybridMetrics, rankCorrelation } = result;

    return [
      `=============================================================`,
      ` HYBRID RAG COMPARATIVE BENCHMARK REPORT`,
      ` Query: "${query}"`,
      `=============================================================`,
      ` [Dense Vector Search]`,
      `   • Latency         : ${denseMetrics.retrievalLatencyMs} ms`,
      `   • Candidates      : ${denseMetrics.candidateCount}`,
      `   • Hybrid Overlap  : ${denseMetrics.overlapWithHybridPercent?.toFixed(1)}%`,
      `   • Top Chunks      : ${denseMetrics.topItemIds.slice(0, 3).join(', ')}`,
      ``,
      ` [Sparse BM25 Search]`,
      `   • Latency         : ${sparseMetrics.retrievalLatencyMs} ms`,
      `   • Candidates      : ${sparseMetrics.candidateCount}`,
      `   • Hybrid Overlap  : ${sparseMetrics.overlapWithHybridPercent?.toFixed(1)}%`,
      `   • Top Chunks      : ${sparseMetrics.topItemIds.slice(0, 3).join(', ')}`,
      ``,
      ` [Hybrid RAG (Dense + Sparse Fusion)]`,
      `   • Latency         : ${hybridMetrics.retrievalLatencyMs} ms`,
      `   • Top Chunks      : ${hybridMetrics.topItemIds.slice(0, 3).join(', ')}`,
      ``,
      ` [Rank Correlation & Candidate Divergence]`,
      `   • Jaccard Index   : ${rankCorrelation.jaccardSimilarity.toFixed(4)}`,
      `   • Kendall's Tau   : ${rankCorrelation.kendallTau.toFixed(4)}`,
      `   • Spearman's Rho  : ${rankCorrelation.spearmanRho.toFixed(4)}`,
      `   • Common Candidates: ${rankCorrelation.commonItemCount}`,
      `=============================================================`
    ].join('\n');
  }
}
