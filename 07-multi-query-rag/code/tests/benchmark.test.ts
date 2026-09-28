import { vectorStoreService } from '../src/services/vector-store.service';
import { benchmarkService } from '../src/services/benchmark.service';

describe('BenchmarkService', () => {
  beforeAll(async () => {
    vectorStoreService.clear();
    await vectorStoreService.bulkIngestDocuments([
      {
        id: 'doc_1',
        content: 'JWT refresh token blacklisting and session expiration redirects unauthorized users to login.',
        metadata: { title: 'Session Security' },
      },
      {
        id: 'doc_2',
        content: 'AuthGuard middleware wraps protected routes in Next.js applications.',
        metadata: { title: 'AuthGuard' },
      },
      {
        id: 'doc_3',
        content: 'Subscription billing refunds are issued within 14 days.',
        metadata: { title: 'Billing' },
      },
    ]);
  });

  it('should run comparative benchmark and compute average metrics', async () => {
    const response = await benchmarkService.runBenchmark({
      queries: ['How to handle expired session access?'],
      numQueries: 3,
    });

    expect(response.testQueriesCount).toBe(1);
    expect(response.results.length).toBe(1);
    expect(response.averageMetrics.avgSingleQueryChunks).toBeGreaterThanOrEqual(0);
    expect(response.averageMetrics.avgMultiQueryUniqueChunks).toBeGreaterThanOrEqual(0);
  });
});
