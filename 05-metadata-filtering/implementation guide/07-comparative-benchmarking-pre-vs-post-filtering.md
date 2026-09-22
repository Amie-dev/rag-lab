# 📊 Chapter 7 — Comparative Benchmarking: Pre-Filtering vs Post-Filtering

Welcome to Chapter 7 of the **Metadata-Filtered RAG Implementation Guide**. In this chapter, we explore the implementation of `BenchmarkService`, the empirical evaluation metrics used to compare **Pre-Filtering** and **Post-Filtering**, zero-result starvation analysis, and candidate waste ratios.

Source code module: [`05-metadata-filtering/code/src/services/benchmarkService.ts`](../code/src/services/benchmarkService.ts).

---

## 1. Benchmarking Methodology

To quantify the differences between Pre-Filtering and Post-Filtering:

1. **Pre-Filtering (Ground Truth)**: Executed first to establish the baseline set of top-$K$ chunks satisfying the metadata filter predicate.
2. **Post-Filtering Sweep**: Executed across multiple global candidate limits $N \in [5, 10, 20, 50]$.
3. **Precision @ K Calculation**:
   $$\text{Precision} = \frac{|\text{PostFilterResults} \cap \text{PreFilterGroundTruth}|}{\min(K, |\text{PreFilterGroundTruth}|)}$$
4. **Candidate Starvation Check**: Triggers a warning if $\text{PostFilterResults} = 0$ while $|\text{PreFilterGroundTruth}| > 0$.

---

## 2. Source Code Implementation: `BenchmarkService`

File: [`05-metadata-filtering/code/src/services/benchmarkService.ts`](../code/src/services/benchmarkService.ts)

```typescript
import { BenchmarkComparisonResultDTO, BenchmarkQueryDTO } from '../types/api.types';
import { RAGService } from './ragService';

export class BenchmarkService {
  private ragService: RAGService;

  constructor(ragService: RAGService) {
    this.ragService = ragService;
  }

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

    // 2. Run Post-Filtering across varying candidate limits
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
```

---

## 3. Sample Benchmark Execution Output

When executed via API (`POST /api/v1/benchmark/filter-comparison`) or CLI (`npx ts-node src/cli.ts benchmark`):

```json
{
  "data": {
    "query": "refund policy",
    "filter": { "tenant_id": "tenant_101" },
    "topK": 5,
    "preFilter": {
      "retrievedCount": 4,
      "candidatesEvaluated": 4,
      "latencyMs": 1,
      "avgScore": 0.8245,
      "returnedChunkIds": ["doc_tenant101_refund_pdf_chunk_0", "doc_tenant101_hr_leave_pdf_chunk_0"]
    },
    "postFilterRuns": [
      {
        "candidateLimit": 2,
        "retrievedCount": 1,
        "precisionVersusPreFilter": 0.25,
        "zeroResultOccurred": false
      },
      {
        "candidateLimit": 10,
        "retrievedCount": 4,
        "precisionVersusPreFilter": 1.0,
        "zeroResultOccurred": false
      }
    ],
    "analysis": {
      "recommendation": "Pre-filtering is recommended. It guarantees top-K retrieval within valid metadata constraints without candidate starvation."
    }
  }
}
```
