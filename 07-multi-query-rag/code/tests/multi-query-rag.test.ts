import { vectorStoreService } from '../src/services/vector-store.service';
import { multiQueryRAGService } from '../src/services/multi-query-rag.service';

describe('MultiQueryRAGService', () => {
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
        content: 'Subscription cancellation refunds are processed within 14 days of invoice issue.',
        metadata: { title: 'Refunds' },
      },
    ]);
  });

  it('should execute end-to-end multi-query search', async () => {
    const searchResponse = await multiQueryRAGService.search({
      query: 'How to handle expired user session access?',
      numQueries: 3,
      topKPerQuery: 2,
    });

    expect(searchResponse.generatedQueries.length).toBeGreaterThanOrEqual(2);
    expect(searchResponse.totalCandidatesRetrieved).toBeGreaterThan(0);
    expect(searchResponse.uniqueCandidatesDeduplicated).toBeGreaterThan(0);
    expect(searchResponse.topContextChunks.length).toBeGreaterThan(0);
  });

  it('should execute end-to-end multi-query RAG and return grounded answer', async () => {
    const ragResponse = await multiQueryRAGService.executeRAG({
      question: 'How to handle expired user session access?',
      numQueries: 3,
    });

    expect(ragResponse.question).toBe('How to handle expired user session access?');
    expect(ragResponse.answer).toBeTruthy();
    expect(ragResponse.confidenceScore).toBeGreaterThan(0);
    expect(ragResponse.citedChunkIds.length).toBeGreaterThan(0);
    expect(ragResponse.retrievedContext.length).toBeGreaterThan(0);
  });
});
