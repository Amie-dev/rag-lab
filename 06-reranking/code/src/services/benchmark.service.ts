import { retrievalPipelineService } from './retrieval-pipeline.service';
import { inMemoryVectorStore } from '../vectordb/in-memory-vector-store';
import { PipelineOptions, RerankerProvider, RetrievalMode } from '../types';

export interface SingleBenchmarkQueryReport {
  query: string;
  stage1Top1ChunkId: string;
  stage2Top1ChunkId: string;
  topRankShifted: boolean;
  stage1LatencyMs: number;
  stage2LatencyMs: number;
  totalLatencyMs: number;
  stage1Top5ChunkIds: string[];
  stage2Top5ChunkIds: string[];
  rankSwaps: Array<{
    chunkId: string;
    stage1Rank: number;
    finalRank: number;
    delta: number;
  }>;
}

export interface CandidateSizeSweepItem {
  candidateN: number;
  topRankShiftRate: number;
  avgStage1LatencyMs: number;
  avgStage2LatencyMs: number;
  avgTotalLatencyMs: number;
}

export interface ComprehensiveBenchmarkReport {
  timestamp: string;
  totalQueriesEvaluated: number;
  totalDatasetDocuments: number;
  retrievalMode: RetrievalMode;
  rerankerProvider: RerankerProvider;
  topRankShiftCount: number;
  topRankShiftPercentage: number;
  avgStage1LatencyMs: number;
  avgStage2LatencyMs: number;
  avgTotalLatencyMs: number;
  candidateSizeSweep: CandidateSizeSweepItem[];
  detailedQueryResults: SingleBenchmarkQueryReport[];
}

export class BenchmarkService {
  /**
   * Default evaluation queries covering multi-domain information seeking.
   */
  private defaultBenchmarkQueries = [
    'How do I reset my account password?',
    'What is our subscription refund and billing policy?',
    'How do I configure database connection pooling for high concurrency?',
    'What security protocols apply to multi-tenant isolation?',
    'How to troubleshoot API rate limiting errors 429?',
  ];

  /**
   * Runs a comprehensive evaluation benchmark comparing Stage 1 vector/hybrid retrieval against Stage 2 reranked retrieval.
   */
  async runBenchmark(
    customQueries?: string[],
    candidateSizes: number[] = [5, 10, 20, 50],
    topK = 5,
    retrievalMode: RetrievalMode = 'hybrid',
    rerankerProvider: RerankerProvider = 'local'
  ): Promise<ComprehensiveBenchmarkReport> {
    const queries = customQueries && customQueries.length > 0 ? customQueries : this.defaultBenchmarkQueries;
    const totalDocs = inMemoryVectorStore.count();

    const queryReports: SingleBenchmarkQueryReport[] = [];
    let totalStage1Time = 0;
    let totalStage2Time = 0;
    let totalTotalTime = 0;
    let topShiftCount = 0;

    // Standard run with default candidate size 20
    const defaultPipelineOpts: PipelineOptions = {
      stage1CandidateTopN: 20,
      stage2FinalTopK: topK,
      retrievalMode,
      rerankerProvider,
    };

    for (const query of queries) {
      const res = await retrievalPipelineService.executePipeline(query, defaultPipelineOpts);

      const stage1Top1 = res.candidates[0]?.chunk.id || 'N/A';
      const stage2Top1 = res.rerankedResults[0]?.chunk.id || 'N/A';
      const shifted = res.metrics.topRankShift;

      if (shifted) topShiftCount++;

      totalStage1Time += res.metrics.stage1LatencyMs;
      totalStage2Time += res.metrics.stage2LatencyMs;
      totalTotalTime += res.metrics.totalLatencyMs;

      const rankSwaps = res.rerankedResults.map((r) => ({
        chunkId: r.chunk.id,
        stage1Rank: r.stage1Rank,
        finalRank: r.finalRank,
        delta: r.rankDelta,
      }));

      queryReports.push({
        query,
        stage1Top1ChunkId: stage1Top1,
        stage2Top1ChunkId: stage2Top1,
        topRankShifted: shifted,
        stage1LatencyMs: res.metrics.stage1LatencyMs,
        stage2LatencyMs: res.metrics.stage2LatencyMs,
        totalLatencyMs: res.metrics.totalLatencyMs,
        stage1Top5ChunkIds: res.candidates.slice(0, 5).map((c) => c.chunk.id),
        stage2Top5ChunkIds: res.rerankedResults.slice(0, 5).map((r) => r.chunk.id),
        rankSwaps,
      });
    }

    // Candidate Pool Size Sweep Analysis ($N \in \{5, 10, 20, 50\}$)
    const sweepResults: CandidateSizeSweepItem[] = [];

    for (const n of candidateSizes) {
      let sweepShiftCount = 0;
      let sweepStage1Latency = 0;
      let sweepStage2Latency = 0;
      let sweepTotalLatency = 0;

      for (const query of queries) {
        const sweepRes = await retrievalPipelineService.executePipeline(query, {
          stage1CandidateTopN: n,
          stage2FinalTopK: topK,
          retrievalMode,
          rerankerProvider,
        });

        if (sweepRes.metrics.topRankShift) sweepShiftCount++;
        sweepStage1Latency += sweepRes.metrics.stage1LatencyMs;
        sweepStage2Latency += sweepRes.metrics.stage2LatencyMs;
        sweepTotalLatency += sweepRes.metrics.totalLatencyMs;
      }

      const qLen = queries.length || 1;
      sweepResults.push({
        candidateN: n,
        topRankShiftRate: Math.round((sweepShiftCount / qLen) * 100) / 100,
        avgStage1LatencyMs: Math.round((sweepStage1Latency / qLen) * 100) / 100,
        avgStage2LatencyMs: Math.round((sweepStage2Latency / qLen) * 100) / 100,
        avgTotalLatencyMs: Math.round((sweepTotalLatency / qLen) * 100) / 100,
      });
    }

    const qCount = queries.length || 1;

    return {
      timestamp: new Date().toISOString(),
      totalQueriesEvaluated: queries.length,
      totalDatasetDocuments: totalDocs,
      retrievalMode,
      rerankerProvider,
      topRankShiftCount: topShiftCount,
      topRankShiftPercentage: Math.round((topShiftCount / qCount) * 10000) / 100,
      avgStage1LatencyMs: Math.round((totalStage1Time / qCount) * 100) / 100,
      avgStage2LatencyMs: Math.round((totalStage2Time / qCount) * 100) / 100,
      avgTotalLatencyMs: Math.round((totalTotalTime / qCount) * 100) / 100,
      candidateSizeSweep: sweepResults,
      detailedQueryResults: queryReports,
    };
  }
}

export const benchmarkService = new BenchmarkService();
