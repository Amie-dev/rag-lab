# 📊 Chapter 7 — Quantitative Reranking Evaluation & Benchmarking

Welcome to Chapter 7 of the **Reranking RAG Implementation Guide**. In this chapter, we implement `BenchmarkService` to empirically measure candidate pool size sweeps ($N \in \{5, 10, 20, 50\}$), top-#1 candidate rank swap rates, and latency overhead.

All corresponding code is located in [`06-reranking/code`](../code).

---

## 1. Reranking Evaluation Metrics

| Metric | Definition | Importance |
| :--- | :--- | :--- |
| **Top #1 Rank Swap Rate** | Percentage of queries where reranking changes the top #1 document: $\frac{\text{Shifted Queries}}{\text{Total Queries}} \times 100\%$ | Quantifies how often Stage 1 vector search produces suboptimal top rank |
| **Stage 1 Latency** | Execution time (ms) for vector/BM25/hybrid search | Baseline candidate retrieval overhead |
| **Stage 2 Latency** | Execution time (ms) for Cross-Encoder scoring across $N$ candidates | Reranking computational overhead |
| **Rank Delta ($\Delta r$)** | $r_{\text{stage1}} - r_{\text{final}}$ for each document | Positive delta indicates document promoted by reranker |

---

## 2. Benchmark Service Code Implementation (`src/services/benchmark.service.ts`)

```typescript
export class BenchmarkService {
  async runBenchmark(
    customQueries?: string[],
    candidateSizes: number[] = [5, 10, 20, 50],
    topK = 5,
    retrievalMode: RetrievalMode = 'hybrid',
    rerankerProvider: RerankerProvider = 'local'
  ): Promise<ComprehensiveBenchmarkReport> {
    const queries = customQueries && customQueries.length > 0 ? customQueries : this.defaultBenchmarkQueries;
    const totalDocs = inMemoryVectorStore.count();

    // Candidate Size Sweep Analysis (N = 5, 10, 20, 50)
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

    return {
      timestamp: new Date().toISOString(),
      totalQueriesEvaluated: queries.length,
      totalDatasetDocuments: totalDocs,
      retrievalMode,
      rerankerProvider,
      candidateSizeSweep: sweepResults,
      detailedQueryResults: queryReports,
    };
  }
}
```

In Chapter 8, we present the Interactive CLI, Sample Data, and Testing Suite.
