import { HNSWIndex } from '../src/indexes/hnsw';
import { VectorRecord } from '../src/schemas';

describe('HNSW ANN Index Suite', () => {
  let index: HNSWIndex;

  beforeEach(() => {
    index = new HNSWIndex({ M: 8, efConstruction: 32, efSearch: 16 });
  });

  it('should insert and search nearest vectors correctly', async () => {
    const rec1: VectorRecord = {
      id: 'rec1',
      vector: [1, 0, 0],
      chunk: { id: 'c1', content: 'Apple content', metadata: { documentId: 'd1', chunkIndex: 0, source: 'test' } },
      metadata: { documentId: 'd1', chunkIndex: 0, source: 'test' },
    };

    const rec2: VectorRecord = {
      id: 'rec2',
      vector: [0.99, 0.01, 0],
      chunk: { id: 'c2', content: 'Apple similar content', metadata: { documentId: 'd2', chunkIndex: 0, source: 'test' } },
      metadata: { documentId: 'd2', chunkIndex: 0, source: 'test' },
    };

    const rec3: VectorRecord = {
      id: 'rec3',
      vector: [0, 1, 0],
      chunk: { id: 'c3', content: 'Banana content', metadata: { documentId: 'd3', chunkIndex: 0, source: 'test' } },
      metadata: { documentId: 'd3', chunkIndex: 0, source: 'test' },
    };

    await index.insertBatch([rec1, rec2, rec3]);

    expect(index.count()).toBe(3);

    const query = [1, 0, 0];
    const results = await index.search(query, 2, 'cosine');

    expect(results.length).toBe(2);
    expect(results[0].record.id).toBe('rec1');
    expect(results[1].record.id).toBe('rec2');
  });

  it('should remove items correctly', async () => {
    const rec1: VectorRecord = {
      id: 'rec1',
      vector: [1, 0, 0],
      chunk: { id: 'c1', content: 'Test', metadata: { documentId: 'd1', chunkIndex: 0, source: 'test' } },
      metadata: { documentId: 'd1', chunkIndex: 0, source: 'test' },
    };

    await index.insert(rec1);
    expect(index.count()).toBe(1);

    const removed = await index.remove('rec1');
    expect(removed).toBe(true);
    expect(index.count()).toBe(0);
  });
});
