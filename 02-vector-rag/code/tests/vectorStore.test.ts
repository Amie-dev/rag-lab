import { VectorStore } from '../src/vectordb/vectorStore';
import { VectorRecord } from '../src/schemas';

describe('VectorStore & Metadata Filtering Suite', () => {
  let store: VectorStore;

  beforeEach(() => {
    store = new VectorStore({ indexConfig: { type: 'flat' } });
  });

  it('should support MongoDB-style metadata payload filtering ($eq, $gte, $in)', async () => {
    const records: VectorRecord[] = [
      {
        id: 'rec_cat_1',
        vector: [1, 0, 0],
        chunk: { id: 'c1', content: 'Cat health guide', metadata: { documentId: 'd1', chunkIndex: 0, source: 'guide', category: 'pets', year: 2024 } },
        metadata: { documentId: 'd1', chunkIndex: 0, source: 'guide', category: 'pets', year: 2024 },
      },
      {
        id: 'rec_dog_1',
        vector: [0.9, 0.1, 0],
        chunk: { id: 'c2', content: 'Dog health guide', metadata: { documentId: 'd2', chunkIndex: 0, source: 'guide', category: 'pets', year: 2021 } },
        metadata: { documentId: 'd2', chunkIndex: 0, source: 'guide', category: 'pets', year: 2021 },
      },
      {
        id: 'rec_car_1',
        vector: [0, 1, 0],
        chunk: { id: 'c3', content: 'Automobile repair', metadata: { documentId: 'd3', chunkIndex: 0, source: 'guide', category: 'auto', year: 2024 } },
        metadata: { documentId: 'd3', chunkIndex: 0, source: 'guide', category: 'auto', year: 2024 },
      },
    ];

    await store.addBatch(records);
    expect(store.count()).toBe(3);

    // Search pets category in year >= 2023
    const results = await store.search([1, 0, 0], 5, 'cosine', {
      category: 'pets',
      year: { $gte: 2023 },
    });

    expect(results.length).toBe(1);
    expect(results[0].recordId).toBe('rec_cat_1');
  });

  it('should filter results by minSimilarityScore threshold', async () => {
    const records: VectorRecord[] = [
      {
        id: 'r1',
        vector: [1, 0, 0],
        chunk: { id: 'c1', content: 'Same vector', metadata: { documentId: 'd1', chunkIndex: 0, source: 'test' } },
        metadata: { documentId: 'd1', chunkIndex: 0, source: 'test' },
      },
      {
        id: 'r2',
        vector: [0, 1, 0],
        chunk: { id: 'c2', content: 'Orthogonal vector', metadata: { documentId: 'd2', chunkIndex: 0, source: 'test' } },
        metadata: { documentId: 'd2', chunkIndex: 0, source: 'test' },
      },
    ];

    await store.addBatch(records);

    const highQualityOnly = await store.search([1, 0, 0], 5, 'cosine', undefined, 0.8);
    expect(highQualityOnly.length).toBe(1);
    expect(highQualityOnly[0].recordId).toBe('r1');
  });
});
