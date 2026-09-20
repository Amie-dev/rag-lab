import { RankCorrelationAnalyzer } from '../src/analysis/rank-correlation';
import { HybridBenchmarkRunner } from '../src/analysis/benchmark';
import { HybridRAGPipeline } from '../src/pipeline/hybrid-pipeline';
import { Document } from '../src/schemas';

describe('Benchmarking & Analytics Subsystem', () => {
  describe('Rank Correlation Analyzer', () => {
    it('should compute Kendall Tau and Spearman Rho for overlapping candidate lists', () => {
      const denseIds = ['chunk_1', 'chunk_2', 'chunk_3', 'chunk_4'];
      const sparseIds = ['chunk_2', 'chunk_1', 'chunk_4', 'chunk_5'];

      const result = RankCorrelationAnalyzer.analyze(denseIds, sparseIds);

      expect(result.commonItemCount).toBe(3); // chunk_1, chunk_2, chunk_4
      expect(result.jaccardSimilarity).toBeCloseTo(3 / 5, 2);
      expect(result.kendallTau).toBeDefined();
      expect(result.spearmanRho).toBeDefined();
    });

    it('should handle disjoint candidate lists without errors', () => {
      const denseIds = ['chunk_1', 'chunk_2'];
      const sparseIds = ['chunk_3', 'chunk_4'];

      const result = RankCorrelationAnalyzer.analyze(denseIds, sparseIds);

      expect(result.commonItemCount).toBe(0);
      expect(result.jaccardSimilarity).toBe(0);
      expect(result.kendallTau).toBe(0);
      expect(result.spearmanRho).toBe(0);
    });
  });

  describe('HybridBenchmarkRunner', () => {
    const docs: Document[] = [
      {
        id: 'doc_1',
        content: 'Network firewall port forwarding rules for ERR_CONNECTION_TIMED_OUT.',
        metadata: { source: 'sample' }
      },
      {
        id: 'doc_2',
        content: 'React component rendering optimization with useMemo hook.',
        metadata: { source: 'sample' }
      }
    ];

    it('should run comparative query benchmark across Dense, Sparse, and Hybrid', async () => {
      const pipeline = new HybridRAGPipeline();
      await pipeline.indexDocuments(docs);

      const runner = new HybridBenchmarkRunner(pipeline);
      const res = await runner.runQueryBenchmark('ERR_CONNECTION_TIMED_OUT', { topK: 2 });

      expect(res.query).toBe('ERR_CONNECTION_TIMED_OUT');
      expect(res.denseMetrics.candidateCount).toBeGreaterThan(0);
      expect(res.sparseMetrics.candidateCount).toBeGreaterThan(0);
      expect(res.hybridMetrics.candidateCount).toBeGreaterThan(0);

      const report = HybridBenchmarkRunner.formatBenchmarkReport(res);
      expect(report).toContain('HYBRID RAG COMPARATIVE BENCHMARK REPORT');
    });
  });
});
