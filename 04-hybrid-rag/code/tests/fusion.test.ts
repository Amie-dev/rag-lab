import { ReciprocalRankFusion } from '../src/fusion/rrf';
import { WeightedScoreFusion, WeightedRRF } from '../src/fusion/weighted-fusion';
import { ScoreNormalizer } from '../src/fusion/normalizer';
import { FusionExplainer } from '../src/fusion/explainer';
import { DenseRetrievalResult, SparseRetrievalResult, Chunk } from '../src/schemas';

describe('Rank & Score Fusion Subsystem', () => {
  const dummyChunkA: Chunk = {
    id: 'chunk_A',
    content: 'Document A content about network connection timeouts',
    metadata: { documentId: 'doc_A', chunkIndex: 0, source: 'test' }
  };

  const dummyChunkB: Chunk = {
    id: 'chunk_B',
    content: 'Document B content about React performance hooks',
    metadata: { documentId: 'doc_B', chunkIndex: 0, source: 'test' }
  };

  const dummyChunkC: Chunk = {
    id: 'chunk_C',
    content: 'Document C content containing ERR_CONNECTION_TIMED_OUT',
    metadata: { documentId: 'doc_C', chunkIndex: 0, source: 'test' }
  };

  const denseResults: DenseRetrievalResult[] = [
    { recordId: 'chunk_A', chunk: dummyChunkA, score: 0.92, distance: 0.08, metric: 'cosine', rank: 1 },
    { recordId: 'chunk_B', chunk: dummyChunkB, score: 0.85, distance: 0.15, metric: 'cosine', rank: 2 },
    { recordId: 'chunk_C', chunk: dummyChunkC, score: 0.70, distance: 0.30, metric: 'cosine', rank: 3 }
  ];

  const sparseResults: SparseRetrievalResult[] = [
    { docId: 'doc_C', chunk: dummyChunkC, score: 12.5, matchedTerms: ['err_connection_timed_out'], rank: 1 },
    { docId: 'doc_A', chunk: dummyChunkA, score: 8.2, matchedTerms: ['network'], rank: 2 }
  ];

  describe('Reciprocal Rank Fusion (RRF)', () => {
    it('should calculate correct RRF scores with default k=60', () => {
      const rrf = new ReciprocalRankFusion({ k: 60 });
      const merged = rrf.fuse(denseResults, sparseResults, 3);

      expect(merged).toHaveLength(3);

      // Document A: Dense rank 1, Sparse rank 2 -> 1/61 + 1/62 = 0.0163934 + 0.016129 = 0.0325224
      // Document C: Dense rank 3, Sparse rank 1 -> 1/63 + 1/61 = 0.015873 + 0.0163934 = 0.0322664
      const chunkA = merged.find((r) => r.chunk.id === 'chunk_A')!;
      const chunkC = merged.find((r) => r.chunk.id === 'chunk_C')!;

      expect(chunkA.finalScore).toBeCloseTo(1 / 61 + 1 / 62, 5);
      expect(chunkC.finalScore).toBeCloseTo(1 / 63 + 1 / 61, 5);
      expect(merged[0].chunk.id).toBe('chunk_A');
      expect(merged[1].chunk.id).toBe('chunk_C');
    });

    it('should respect custom k parameter', () => {
      const rrf = new ReciprocalRankFusion({ k: 10 });
      const merged = rrf.fuse(denseResults, sparseResults, 3);
      const chunkA = merged.find((r) => r.chunk.id === 'chunk_A')!;

      // 1/(10+1) + 1/(10+2) = 1/11 + 1/12
      expect(chunkA.finalScore).toBeCloseTo(1 / 11 + 1 / 12, 5);
    });
  });

  describe('Score Normalizers', () => {
    const items = [
      { id: '1', score: 10 },
      { id: '2', score: 20 },
      { id: '3', score: 30 }
    ];

    it('should normalize scores using MinMax', () => {
      const normMap = ScoreNormalizer.normalize(items, 'minmax');
      expect(normMap.get('1')).toBe(0.0);
      expect(normMap.get('2')).toBe(0.5);
      expect(normMap.get('3')).toBe(1.0);
    });

    it('should normalize scores using ZScore with Sigmoid', () => {
      const normMap = ScoreNormalizer.normalize(items, 'zscore');
      expect(normMap.get('2')).toBeCloseTo(0.5, 2); // mean has z=0 -> sigmoid(0)=0.5
      expect(normMap.get('3')!).toBeGreaterThan(0.5);
      expect(normMap.get('1')!).toBeLessThan(0.5);
    });

    it('should normalize scores using Softmax', () => {
      const normMap = ScoreNormalizer.normalize(items, 'softmax');
      let sum = 0;
      for (const val of normMap.values()) {
        sum += val;
      }
      expect(sum).toBeCloseTo(1.0, 5);
      expect(normMap.get('3')!).toBeGreaterThan(normMap.get('1')!);
    });
  });

  describe('Weighted Score Fusion', () => {
    it('should merge dense and sparse using alpha weighting', () => {
      const fusion = new WeightedScoreFusion({ alpha: 0.7, normalizerType: 'minmax' });
      const merged = fusion.fuse(denseResults, sparseResults, 3);

      expect(merged).toHaveLength(3);
      expect(merged[0].explanation.strategyUsed).toBe('weighted_score');
    });
  });

  describe('Weighted RRF', () => {
    it('should apply weights to RRF reciprocal terms', () => {
      const fusion = new WeightedRRF({ alpha: 0.8, rrfK: 60 });
      const merged = fusion.fuse(denseResults, sparseResults, 3);

      expect(merged).toHaveLength(3);
      expect(merged[0].explanation.strategyUsed).toBe('weighted_rrf');
    });
  });

  describe('Fusion Explainer', () => {
    it('should generate human-readable mathematical audit strings', () => {
      const rrf = new ReciprocalRankFusion({ k: 60 });
      const merged = rrf.fuse(denseResults, sparseResults, 2);
      const text = FusionExplainer.formatAll(merged);

      expect(text).toContain('Rank #1');
      expect(text).toContain('Strategy: RRF');
      expect(text).toContain('Dense Vector Search');
      expect(text).toContain('Sparse BM25 Search');
    });
  });
});
