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

    const wDense = 2 * this.alpha;       // Default alpha=0.5 -> wDense=1.0
    const wSparse = 2 * (1 - this.alpha); // Default alpha=0.5 -> wSparse=1.0

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
