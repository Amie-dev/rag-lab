import { VectorBenchmarkRunner } from '../src/pipeline/benchmark';

describe('VectorBenchmarkRunner Suite', () => {
  it('should run benchmark across Flat, HNSW, and IVF indexes and return performance metrics', async () => {
    const results = await VectorBenchmarkRunner.runBenchmark(30, 3, 'cosine');

    expect(results.length).toBe(3);
    const indexNames = results.map((r) => r.indexType);
    expect(indexNames).toContain('flat');
    expect(indexNames).toContain('hnsw');
    expect(indexNames).toContain('ivf');

    const flatResult = results.find((r) => r.indexType === 'flat');
    expect(flatResult?.recallAtK).toBe(1.0);
  });
});
