import { benchmarkService } from '../src/services/benchmark.service';
import { inMemoryVectorStore } from '../src/vectordb/in-memory-vector-store';
import { embeddingService } from '../src/services/embedding.service';
import { DocumentChunk } from '../src/types';

describe('BenchmarkService', () => {
  beforeAll(async () => {
    inMemoryVectorStore.clear();
    const doc: DocumentChunk = {
      id: 'doc-bench-1',
      content: 'Database connection pooling configuration maxPoolSize=50',
      metadata: { title: 'DB Pool Config' },
    };
    doc.embedding = await embeddingService.generateEmbedding(`${doc.metadata.title} ${doc.content}`);
    inMemoryVectorStore.upsertChunk(doc);
  });

  it('should run benchmark suite and return candidate size sweep analysis', async () => {
    const report = await benchmarkService.runBenchmark(
      ['connection pooling'],
      [2, 5],
      1,
      'hybrid',
      'local'
    );

    expect(report.totalQueriesEvaluated).toBe(1);
    expect(report.candidateSizeSweep).toHaveLength(2);
    expect(report.candidateSizeSweep[0].candidateN).toBe(2);
  });
});
