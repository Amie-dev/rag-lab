# 📊 Chapter 8 — Comparative Benchmarking & Rank Correlation

Welcome to Chapter 8 of the **Hybrid RAG Implementation Guide**. In this chapter, we evaluate the comparative performance of **Dense Vector RAG**, **Sparse BM25 RAG**, and **Hybrid RAG**, measuring candidate divergence and rank correlation.

All code snippets in this chapter are taken directly from [`04-hybrid-rag/code`](../code).

---

## 1. Rank Correlation Analysis (`src/analysis/rank-correlation.ts`)

File: [`04-hybrid-rag/code/src/analysis/rank-correlation.ts`](../code/src/analysis/rank-correlation.ts)

```typescript
import { RankCorrelationResult } from '../schemas';

export class RankCorrelationAnalyzer {
  static analyze(denseItemIds: string[], sparseItemIds: string[]): RankCorrelationResult {
    const denseSet = new Set(denseItemIds);
    const sparseSet = new Set(sparseItemIds);

    // Common items present in both lists
    const common = denseItemIds.filter((id) => sparseSet.has(id));
    const commonCount = common.length;

    // Jaccard similarity: |A ∩ B| / |A ∪ B|
    const unionSet = new Set([...denseItemIds, ...sparseItemIds]);
    const jaccard = unionSet.size === 0 ? 0 : commonCount / unionSet.size;

    if (commonCount < 2) {
      return {
        kendallTau: 0,
        spearmanRho: 0,
        commonItemCount: commonCount,
        jaccardSimilarity: jaccard
      };
    }

    // Rank maps for common items
    const denseRankMap = new Map<string, number>();
    denseItemIds.forEach((id, idx) => denseRankMap.set(id, idx + 1));

    const sparseRankMap = new Map<string, number>();
    sparseItemIds.forEach((id, idx) => sparseRankMap.set(id, idx + 1));

    // Kendall's Tau calculation on common pairs
    let concordant = 0;
    let discordant = 0;

    for (let i = 0; i < commonCount; i++) {
      for (let j = i + 1; j < commonCount; j++) {
        const itemA = common[i];
        const itemB = common[j];

        const denseDiff = denseRankMap.get(itemA)! - denseRankMap.get(itemB)!;
        const sparseDiff = sparseRankMap.get(itemA)! - sparseRankMap.get(itemB)!;

        if (denseDiff * sparseDiff > 0) {
          concordant++;
        } else if (denseDiff * sparseDiff < 0) {
          discordant++;
        }
      }
    }

    const totalPairs = (commonCount * (commonCount - 1)) / 2;
    const kendallTau = totalPairs === 0 ? 0 : (concordant - discordant) / totalPairs;

    // Spearman's Rho calculation on common items
    let sumD2 = 0;
    for (const item of common) {
      const d = denseRankMap.get(item)! - sparseRankMap.get(item)!;
      sumD2 += d * d;
    }
    const spearmanRho = 1 - (6 * sumD2) / (commonCount * (Math.pow(commonCount, 2) - 1));

    return {
      kendallTau: isNaN(kendallTau) ? 0 : kendallTau,
      spearmanRho: isNaN(spearmanRho) ? 0 : spearmanRho,
      commonItemCount: commonCount,
      jaccardSimilarity: jaccard
    };
  }
}
```

### Methods Explanation (`RankCorrelationAnalyzer`)
- `analyze(denseItemIds, sparseItemIds)`: Evaluates candidate divergence between dense and sparse results:
  - **Jaccard Similarity**: $|A \cap B| / |A \cup B|$. Measures overall candidate set overlap.
  - **Kendall's Tau ($\tau$)**: Evaluates relative ordering of pairs common to both candidate lists. Identifies concordant pairs ($(R_d(A) - R_d(B)) \cdot (R_s(A) - R_s(B)) > 0$) vs discordant pairs.
  - **Spearman's Rho ($\rho$)**: Measures rank correlation based on rank differences $1 - \frac{6 \sum d_i^2}{n(n^2 - 1)}$.

---

## 2. Comparative Benchmark Runner (`src/analysis/benchmark.ts`)

File: [`04-hybrid-rag/code/src/analysis/benchmark.ts`](../code/src/analysis/benchmark.ts)

```typescript
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
```

In [Chapter 9](./09-interactive-cli-and-testing-suite.md), we will explore the **Interactive CLI & Testing Suite**.
