# 🔀 Chapter 4 — Rank & Score Fusion Subsystem

Welcome to Chapter 4 of the **Hybrid RAG Implementation Guide**. In this chapter, we explore the **Rank & Score Fusion Subsystem**, which merges dense vector candidates and sparse BM25 candidates into a single candidate list.

All code snippets in this chapter are taken directly from [`04-hybrid-rag/code`](../code).

---

## 1. Score Normalizers (`src/fusion/normalizer.ts`)

File: [`04-hybrid-rag/code/src/fusion/normalizer.ts`](../code/src/fusion/normalizer.ts)

```typescript
import { ScoreNormalizerType } from '../schemas';

export interface ScoreItem {
  id: string;
  score: number;
}

export class ScoreNormalizer {
  static normalize(items: ScoreItem[], method: ScoreNormalizerType): Map<string, number> {
    const normalized = new Map<string, number>();
    if (items.length === 0) return normalized;

    if (method === 'none') {
      items.forEach((item) => normalized.set(item.id, item.score));
      return normalized;
    }

    const scores = items.map((i) => i.score);

    switch (method) {
      case 'minmax': {
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const range = max - min;

        items.forEach((item) => {
          const normVal = range === 0 ? 1.0 : (item.score - min) / range;
          normalized.set(item.id, normVal);
        });
        break;
      }
      case 'zscore': {
        const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
        const std = Math.sqrt(variance);

        items.forEach((item) => {
          const z = std === 0 ? 0 : (item.score - mean) / std;
          // Apply Sigmoid function to map Z-score to range (0, 1)
          const sigmoid = 1 / (1 + Math.exp(-z));
          normalized.set(item.id, sigmoid);
        });
        break;
      }
      case 'softmax': {
        const maxScore = Math.max(...scores);
        const expScores = scores.map((s) => Math.exp(s - maxScore));
        const sumExp = expScores.reduce((sum, e) => sum + e, 0);

        items.forEach((item, idx) => {
          const prob = sumExp === 0 ? 1 / items.length : expScores[idx] / sumExp;
          normalized.set(item.id, prob);
        });
        break;
      }
      default:
        throw new Error(`Unsupported normalizer type: ${method}`);
    }

    return normalized;
  }
}
```

### Methods Explanation (`ScoreNormalizer`)
- `normalize(items, method)`: Accepts candidate items and normalizes raw score arrays:
  - `minmax`: $(s - s_{\min}) / (s_{\max} - s_{\min})$.
  - `zscore`: Standardizes $z = (s - \mu) / \sigma$, then applies Sigmoid $\frac{1}{1 + e^{-z}}$ to squash scores into $(0, 1)$.
  - `softmax`: Computes numerically stable Softmax probability distribution $\frac{e^{s_i - s_{\max}}}{\sum e^{s_j - s_{\max}}}$.

---

## 2. Reciprocal Rank Fusion (RRF) (`src/fusion/rrf.ts`)

File: [`04-hybrid-rag/code/src/fusion/rrf.ts`](../code/src/fusion/rrf.ts)

```typescript
import {
  DenseRetrievalResult,
  SparseRetrievalResult,
  HybridRetrievalResult,
  Chunk
} from '../schemas';

export interface RRFConfig {
  k?: number; // RRF smoothing constant (default: 60)
}

export class ReciprocalRankFusion {
  private k: number;

  constructor(config?: RRFConfig) {
    this.k = config?.k ?? 60;
  }

  fuse(
    denseResults: DenseRetrievalResult[],
    sparseResults: SparseRetrievalResult[],
    topK: number = 5
  ): HybridRetrievalResult[] {
    const candidateChunks = new Map<string, Chunk>();
    const denseMap = new Map<string, DenseRetrievalResult>();
    const sparseMap = new Map<string, SparseRetrievalResult>();
    const rrfScores = new Map<string, number>();

    // Process Dense results
    denseResults.forEach((denseRes) => {
      const id = denseRes.chunk.id;
      candidateChunks.set(id, denseRes.chunk);
      denseMap.set(id, denseRes);

      const denseContrib = 1 / (this.k + denseRes.rank);
      rrfScores.set(id, (rrfScores.get(id) || 0) + denseContrib);
    });

    // Process Sparse results
    sparseResults.forEach((sparseRes) => {
      const id = sparseRes.chunk.id;
      candidateChunks.set(id, sparseRes.chunk);
      sparseMap.set(id, sparseRes);

      const sparseContrib = 1 / (this.k + sparseRes.rank);
      rrfScores.set(id, (rrfScores.get(id) || 0) + sparseContrib);
    });

    // Build merged candidate items
    const mergedList: Array<{ id: string; chunk: Chunk; rrfScore: number }> = [];
    for (const [id, chunk] of candidateChunks.entries()) {
      mergedList.push({
        id,
        chunk,
        rrfScore: rrfScores.get(id) || 0
      });
    }

    // Sort descending by RRF score
    mergedList.sort((a, b) => b.rrfScore - a.rrfScore);

    const topResults = mergedList.slice(0, topK);

    return topResults.map((item, index) => {
      const finalRank = index + 1;
      const dense = denseMap.get(item.id);
      const sparse = sparseMap.get(item.id);

      const denseContrib = dense ? 1 / (this.k + dense.rank) : null;
      const sparseContrib = sparse ? 1 / (this.k + sparse.rank) : null;

      const formulaParts: string[] = [];
      if (denseContrib !== null) {
        formulaParts.push(`1/(${this.k} + ${dense!.rank}) [${denseContrib.toFixed(6)}]`);
      }
      if (sparseContrib !== null) {
        formulaParts.push(`1/(${this.k} + ${sparse!.rank}) [${sparseContrib.toFixed(6)}]`);
      }

      return {
        chunk: item.chunk,
        finalScore: item.rrfScore,
        finalRank,
        denseResult: dense,
        sparseResult: sparse,
        explanation: {
          chunkId: item.chunk.id,
          documentId: item.chunk.metadata.documentId || item.chunk.id,
          denseRank: dense ? dense.rank : null,
          denseRawScore: dense ? dense.score : null,
          denseNormalizedScore: null,
          denseRrfContribution: denseContrib,

          sparseRank: sparse ? sparse.rank : null,
          sparseRawScore: sparse ? sparse.score : null,
          sparseNormalizedScore: null,
          sparseRrfContribution: sparseContrib,

          finalHybridScore: item.rrfScore,
          finalRank,
          strategyUsed: 'rrf',
          mathematicalFormula: `RRF Score = ${formulaParts.join(' + ')} = ${item.rrfScore.toFixed(6)}`
        }
      };
    });
  }
}
```

---

## 3. Weighted Score Fusion (`src/fusion/weighted-fusion.ts`)

File: [`04-hybrid-rag/code/src/fusion/weighted-fusion.ts`](../code/src/fusion/weighted-fusion.ts)

```typescript
import {
  DenseRetrievalResult,
  SparseRetrievalResult,
  HybridRetrievalResult,
  ScoreNormalizerType,
  Chunk
} from '../schemas';
import { ScoreNormalizer } from './normalizer';

export interface WeightedFusionConfig {
  alpha?: number; // Weight for dense retrieval [0..1], (default: 0.5)
  normalizerType?: ScoreNormalizerType; // (default: 'minmax')
  rrfK?: number; // (default: 60)
}

export class WeightedScoreFusion {
  private alpha: number;
  private normalizerType: ScoreNormalizerType;

  constructor(config?: WeightedFusionConfig) {
    this.alpha = config?.alpha ?? 0.5;
    this.normalizerType = config?.normalizerType ?? 'minmax';
  }

  fuse(
    denseResults: DenseRetrievalResult[],
    sparseResults: SparseRetrievalResult[],
    topK: number = 5
  ): HybridRetrievalResult[] {
    const candidateChunks = new Map<string, Chunk>();
    const denseMap = new Map<string, DenseRetrievalResult>();
    const sparseMap = new Map<string, SparseRetrievalResult>();

    denseResults.forEach((d) => {
      candidateChunks.set(d.chunk.id, d.chunk);
      denseMap.set(d.chunk.id, d);
    });

    sparseResults.forEach((s) => {
      candidateChunks.set(s.chunk.id, s.chunk);
      sparseMap.set(s.chunk.id, s);
    });

    // Normalize dense scores
    const denseItems = denseResults.map((d) => ({ id: d.chunk.id, score: d.score }));
    const denseNormMap = ScoreNormalizer.normalize(denseItems, this.normalizerType);

    // Normalize sparse scores
    const sparseItems = sparseResults.map((s) => ({ id: s.chunk.id, score: s.score }));
    const sparseNormMap = ScoreNormalizer.normalize(sparseItems, this.normalizerType);

    const mergedList: Array<{ id: string; chunk: Chunk; score: number }> = [];

    for (const [id, chunk] of candidateChunks.entries()) {
      const normDense = denseNormMap.get(id) ?? 0;
      const normSparse = sparseNormMap.get(id) ?? 0;

      const finalScore = this.alpha * normDense + (1 - this.alpha) * normSparse;
      mergedList.push({ id, chunk, score: finalScore });
    }

    mergedList.sort((a, b) => b.score - a.score);

    const topResults = mergedList.slice(0, topK);

    return topResults.map((item, index) => {
      const finalRank = index + 1;
      const dense = denseMap.get(item.id);
      const sparse = sparseMap.get(item.id);
      const normDense = denseNormMap.get(item.id) ?? null;
      const normSparse = sparseNormMap.get(item.id) ?? null;

      const formula = `${this.alpha} * (${normDense?.toFixed(4) ?? 0}) + ${1 - this.alpha} * (${normSparse?.toFixed(4) ?? 0}) = ${item.score.toFixed(4)}`;

      return {
        chunk: item.chunk,
        finalScore: item.score,
        finalRank,
        denseResult: dense,
        sparseResult: sparse,
        explanation: {
          chunkId: item.chunk.id,
          documentId: item.chunk.metadata.documentId || item.chunk.id,
          denseRank: dense ? dense.rank : null,
          denseRawScore: dense ? dense.score : null,
          denseNormalizedScore: normDense,
          denseRrfContribution: null,

          sparseRank: sparse ? sparse.rank : null,
          sparseRawScore: sparse ? sparse.score : null,
          sparseNormalizedScore: normSparse,
          sparseRrfContribution: null,

          finalHybridScore: item.score,
          finalRank,
          strategyUsed: 'weighted_score',
          mathematicalFormula: `Weighted Score (${this.normalizerType}) = ${formula}`
        }
      };
    });
  }
}

export class WeightedRRF {
  private alpha: number;
  private k: number;

  constructor(config?: WeightedFusionConfig) {
    this.alpha = config?.alpha ?? 0.5;
    this.k = config?.rrfK ?? 60;
  }

  fuse(
    denseResults: DenseRetrievalResult[],
    sparseResults: SparseRetrievalResult[],
    topK: number = 5
  ): HybridRetrievalResult[] {
    const candidateChunks = new Map<string, Chunk>();
    const denseMap = new Map<string, DenseRetrievalResult>();
    const sparseMap = new Map<string, SparseRetrievalResult>();
    const rrfScores = new Map<string, number>();

    const wDense = 2 * this.alpha;
    const wSparse = 2 * (1 - this.alpha);

    denseResults.forEach((denseRes) => {
      const id = denseRes.chunk.id;
      candidateChunks.set(id, denseRes.chunk);
      denseMap.set(id, denseRes);

      const denseContrib = wDense * (1 / (this.k + denseRes.rank));
      rrfScores.set(id, (rrfScores.get(id) || 0) + denseContrib);
    });

    sparseResults.forEach((sparseRes) => {
      const id = sparseRes.chunk.id;
      candidateChunks.set(id, sparseRes.chunk);
      sparseMap.set(id, sparseRes);

      const sparseContrib = wSparse * (1 / (this.k + sparseRes.rank));
      rrfScores.set(id, (rrfScores.get(id) || 0) + sparseContrib);
    });

    const mergedList: Array<{ id: string; chunk: Chunk; rrfScore: number }> = [];
    for (const [id, chunk] of candidateChunks.entries()) {
      mergedList.push({
        id,
        chunk,
        rrfScore: rrfScores.get(id) || 0
      });
    }

    mergedList.sort((a, b) => b.rrfScore - a.rrfScore);

    const topResults = mergedList.slice(0, topK);

    return topResults.map((item, index) => {
      const finalRank = index + 1;
      const dense = denseMap.get(item.id);
      const sparse = sparseMap.get(item.id);

      const denseContrib = dense ? wDense * (1 / (this.k + dense.rank)) : null;
      const sparseContrib = sparse ? wSparse * (1 / (this.k + sparse.rank)) : null;

      const formulaParts: string[] = [];
      if (denseContrib !== null) {
        formulaParts.push(`${wDense.toFixed(2)} * 1/(${this.k} + ${dense!.rank})`);
      }
      if (sparseContrib !== null) {
        formulaParts.push(`${wSparse.toFixed(2)} * 1/(${this.k} + ${sparse!.rank})`);
      }

      return {
        chunk: item.chunk,
        finalScore: item.rrfScore,
        finalRank,
        denseResult: dense,
        sparseResult: sparse,
        explanation: {
          chunkId: item.chunk.id,
          documentId: item.chunk.metadata.documentId || item.chunk.id,
          denseRank: dense ? dense.rank : null,
          denseRawScore: dense ? dense.score : null,
          denseNormalizedScore: null,
          denseRrfContribution: denseContrib,

          sparseRank: sparse ? sparse.rank : null,
          sparseRawScore: sparse ? sparse.score : null,
          sparseNormalizedScore: null,
          sparseRrfContribution: sparseContrib,

          finalHybridScore: item.rrfScore,
          finalRank,
          strategyUsed: 'weighted_rrf',
          mathematicalFormula: `Weighted RRF Score = ${formulaParts.join(' + ')} = ${item.rrfScore.toFixed(6)}`
        }
      };
    });
  }
}
```

---

## 4. Fusion Explainer (`src/fusion/explainer.ts`)

File: [`04-hybrid-rag/code/src/fusion/explainer.ts`](../code/src/fusion/explainer.ts)

```typescript
import { HybridRetrievalResult } from '../schemas';

export class FusionExplainer {
  static formatExplanation(result: HybridRetrievalResult): string {
    const { explanation, chunk, finalRank, finalScore } = result;

    const lines: string[] = [
      `Rank #${finalRank} | Chunk ID: ${chunk.id} | Final Hybrid Score: ${finalScore.toFixed(6)}`,
      `Strategy: ${explanation.strategyUsed.toUpperCase()}`,
      `Formula: ${explanation.mathematicalFormula}`,
      `Details:`
    ];

    if (explanation.denseRank !== null) {
      lines.push(
        `  • Dense Vector Search : Rank ${explanation.denseRank} | Raw Score: ${explanation.denseRawScore?.toFixed(4) ?? 'N/A'}` +
          (explanation.denseNormalizedScore !== null ? ` | Norm Score: ${explanation.denseNormalizedScore.toFixed(4)}` : '') +
          (explanation.denseRrfContribution !== null ? ` | RRF Contrib: ${explanation.denseRrfContribution.toFixed(6)}` : '')
      );
    } else {
      lines.push(`  • Dense Vector Search : Not in top dense candidates`);
    }

    if (explanation.sparseRank !== null) {
      lines.push(
        `  • Sparse BM25 Search  : Rank ${explanation.sparseRank} | Raw Score: ${explanation.sparseRawScore?.toFixed(4) ?? 'N/A'}` +
          (explanation.sparseNormalizedScore !== null ? ` | Norm Score: ${explanation.sparseNormalizedScore.toFixed(4)}` : '') +
          (explanation.sparseRrfContribution !== null ? ` | RRF Contrib: ${explanation.sparseRrfContribution.toFixed(6)}` : '')
      );
    } else {
      lines.push(`  • Sparse BM25 Search  : Not in top sparse candidates`);
    }

    lines.push(`Content Snippet: "${chunk.content.slice(0, 120).replace(/\n/g, ' ')}..."`);
    return lines.join('\n');
  }

  static formatAll(results: HybridRetrievalResult[]): string {
    return results.map((r, i) => `--- [ Candidate ${i + 1} ] ---\n${this.formatExplanation(r)}`).join('\n\n');
  }
}
```

In [Chapter 5](./05-document-loaders-and-text-splitters.md), we will build the **Document Loaders & Text Splitters**.
