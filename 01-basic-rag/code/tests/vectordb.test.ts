import { InMemoryVectorStore } from '../src/vectordb/inMemory';
import { VectorRecord } from '../src/schemas';

describe('InMemoryVectorStore', () => {
  let store: InMemoryVectorStore;

  const records: VectorRecord[] = [
    {
      id: 'rec_1',
      vector: [1, 0, 0, 0],
      chunk: { id: 'c1', content: 'Vector DBs store embeddings', metadata: { documentId: 'd1', chunkIndex: 0, source: 's1' } },
      metadata: { documentId: 'd1', chunkIndex: 0, source: 's1' },
    },
    {
      id: 'rec_2',
      vector: [0.8, 0.2, 0, 0],
      chunk: { id: 'c2', content: 'Cosine similarity measures angles', metadata: { documentId: 'd1', chunkIndex: 1, source: 's1' } },
      metadata: { documentId: 'd1', chunkIndex: 1, source: 's1' },
    },
    {
      id: 'rec_3',
      vector: [0, 0, 1, 0],
      chunk: { id: 'c3', content: 'Unrelated topic context', metadata: { documentId: 'd2', chunkIndex: 0, source: 's2' } },
      metadata: { documentId: 'd2', chunkIndex: 0, source: 's2' },
    },
  ];

  beforeEach(async () => {
    store = new InMemoryVectorStore();
    await store.add(records);
  });

  test('stores records and reports count correctly', async () => {
    expect(await store.count()).toBe(3);
  });

  test('searches top-K with cosine similarity', async () => {
    const queryVec = [1, 0, 0, 0];
    const results = await store.search(queryVec, 2, 'cosine');
    expect(results).toHaveLength(2);
    expect(results[0].chunk.id).toBe('c1');
    expect(results[0].score).toBeCloseTo(1.0, 4);
    expect(results[1].chunk.id).toBe('c2');
  });

  test('filters results using metadata filter function', async () => {
    const queryVec = [1, 0, 0, 0];
    const results = await store.search(queryVec, 5, 'cosine', (chunk) => chunk.metadata.documentId === 'd2');
    expect(results).toHaveLength(1);
    expect(results[0].chunk.id).toBe('c3');
  });

  test('clears vector store', async () => {
    await store.clear();
    expect(await store.count()).toBe(0);
  });
});
