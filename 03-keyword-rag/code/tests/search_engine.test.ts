import { KeywordSearchEngine } from '../src/search/engine';
import { Chunk } from '../src/schemas';

describe('Keyword Search Engine', () => {
  let engine: KeywordSearchEngine;

  beforeEach(() => {
    engine = new KeywordSearchEngine();

    const chunks: Chunk[] = [
      {
        id: 'c1',
        content: 'Technical Log: ERR_CONNECTION_TIMED_OUT in gateway service during peak load',
        metadata: { documentId: 'd1', chunkIndex: 0, source: 'logs.txt', category: 'logs', env: 'prod' },
      },
      {
        id: 'c2',
        content: 'Stripe integration endpoint POST /api/v1/payments/intent for SKU TX-9021-B',
        metadata: { documentId: 'd2', chunkIndex: 0, source: 'stripe.md', category: 'api', env: 'prod' },
      },
      {
        id: 'c3',
        content: 'Legal statutory compliance under Section 420 IPC and GDPR Article 17 right to erasure',
        metadata: { documentId: 'd3', chunkIndex: 0, source: 'legal.md', category: 'legal', env: 'dev' },
      },
    ];

    engine.indexChunks(chunks, 'technical');
  });

  test('Retrieves exact match technical error codes using Technical Analyzer', () => {
    const results = engine.search({
      query: 'ERR_CONNECTION_TIMED_OUT',
      analyzerType: 'technical',
      topK: 1,
    });

    expect(results.length).toBe(1);
    expect(results[0].chunk.id).toBe('c1');
    expect(results[0].matchedTerms).toContain('err_connection_timed_out');
  });

  test('Retrieves product SKU exact match', () => {
    const results = engine.search({
      query: 'TX-9021-B',
      analyzerType: 'technical',
      topK: 1,
    });

    expect(results.length).toBe(1);
    expect(results[0].chunk.id).toBe('c2');
  });

  test('Applies metadata filtering correctly', () => {
    const results = engine.search({
      query: 'technical legal',
      analyzerType: 'technical',
      filter: { category: 'logs' },
    });

    expect(results.length).toBe(1);
    expect(results[0].chunk.id).toBe('c1');
  });

  test('Generates detailed score explanation when explain flag is true', () => {
    const results = engine.search({
      query: 'ERR_CONNECTION_TIMED_OUT',
      analyzerType: 'technical',
      explain: true,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].explanation).toBeDefined();
    expect(results[0].explanation?.algorithm).toBe('bm25');
    expect(results[0].explanation?.termDetails.length).toBeGreaterThan(0);
  });
});
