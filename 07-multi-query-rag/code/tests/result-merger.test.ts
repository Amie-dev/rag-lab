import { resultMergerService } from '../src/services/result-merger.service';
import { SingleQueryRetrievalResult } from '../src/types';

describe('ResultMergerService', () => {
  it('should merge duplicate chunks from multiple queries and calculate RRF score and attribution', () => {
    const chunk1 = { id: 'c1', content: 'Authentication token expiration', metadata: { title: 'Auth' } };
    const chunk2 = { id: 'c2', content: 'Database indexing optimization', metadata: { title: 'DB' } };
    const chunk3 = { id: 'c3', content: 'Protected routes authorization guard', metadata: { title: 'Routes' } };

    const retrievalResults: SingleQueryRetrievalResult[] = [
      {
        query: 'Query A',
        queryId: 'q_0',
        results: [
          { chunk: chunk1, score: 0.9, retrievalType: 'hybrid' },
          { chunk: chunk2, score: 0.7, retrievalType: 'hybrid' },
        ],
      },
      {
        query: 'Query B',
        queryId: 'q_1',
        results: [
          { chunk: chunk1, score: 0.85, retrievalType: 'hybrid' },
          { chunk: chunk3, score: 0.95, retrievalType: 'hybrid' },
        ],
      },
    ];

    const merged = resultMergerService.mergeAndDeduplicate(retrievalResults, 'rrf');

    expect(merged.length).toBe(3); // c1, c2, c3
    const c1Merged = merged.find((m) => m.chunk.id === 'c1');
    expect(c1Merged).toBeDefined();
    expect(c1Merged?.occurrences).toBe(2);
    expect(c1Merged?.retrievedByQueries).toEqual(['q_0', 'q_1']);
    expect(c1Merged?.rrfScore).toBeGreaterThan(0);
  });

  it('should sort candidates by final score descending', () => {
    const chunk1 = { id: 'c1', content: 'Text 1', metadata: {} };
    const chunk2 = { id: 'c2', content: 'Text 2', metadata: {} };

    const retrievalResults: SingleQueryRetrievalResult[] = [
      {
        query: 'Query A',
        queryId: 'q_0',
        results: [
          { chunk: chunk1, score: 0.5, retrievalType: 'vector' },
          { chunk: chunk2, score: 0.9, retrievalType: 'vector' },
        ],
      },
    ];

    const merged = resultMergerService.mergeAndDeduplicate(retrievalResults, 'max_score');
    expect(merged[0].chunk.id).toBe('c2');
    expect(merged[1].chunk.id).toBe('c1');
  });
});
