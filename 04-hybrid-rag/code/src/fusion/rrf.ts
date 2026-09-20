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
