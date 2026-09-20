import { computeCosineSimilarity, computeDotProduct, computeEuclideanDistance } from '../src/dense/metrics';
import { FlatVectorIndex } from '../src/dense/indexes/flat-index';
import { HNSWVectorIndex } from '../src/dense/indexes/hnsw-index';
import { IVFVectorIndex } from '../src/dense/indexes/ivf-index';
import { VectorStore } from '../src/dense/vector-store';
import { MockEmbeddingModel } from '../src/embeddings/mock-embeddings';
import { VectorRecord, Chunk } from '../src/schemas';

describe('Dense Subsystem', () => {
  describe('Metrics Math', () => {
    it('should compute exact cosine similarity for identical and orthogonal vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [1, 0, 0];
      const v3 = [0, 1, 0];

      expect(computeCosineSimilarity(v1, v2)).toBeCloseTo(1.0, 5);
      expect(computeCosineSimilarity(v1, v3)).toBeCloseTo(0.0, 5);
    });

    it('should compute dot product and euclidean distance correctly', () => {
      const v1 = [3, 4];
      const v2 = [0, 0];

      expect(computeDotProduct(v1, [1, 2])).toBe(11);
      expect(computeEuclideanDistance(v1, v2)).toBe(5);
    });
  });

  describe('Vector Indexes (Flat, HNSW, IVF)', () => {
    const records: VectorRecord[] = [
      {
        id: 'rec_1',
        vector: [1, 0, 0, 0],
        chunk: { id: 'c1', content: 'c1', metadata: { documentId: 'd1', chunkIndex: 0, source: 't' } },
        metadata: { documentId: 'd1', chunkIndex: 0, source: 't' }
      },
      {
        id: 'rec_2',
        vector: [0, 1, 0, 0],
        chunk: { id: 'c2', content: 'c2', metadata: { documentId: 'd2', chunkIndex: 0, source: 't' } },
        metadata: { documentId: 'd2', chunkIndex: 0, source: 't' }
      },
      {
        id: 'rec_3',
        vector: [0.9, 0.1, 0, 0],
        chunk: { id: 'c3', content: 'c3', metadata: { documentId: 'd3', chunkIndex: 0, source: 't' } },
        metadata: { documentId: 'd3', chunkIndex: 0, source: 't' }
      }
    ];

    it('should rank items accurately in Flat index', () => {
      const index = new FlatVectorIndex('cosine');
      index.addBatch(records);

      const query = [1, 0, 0, 0];
      const results = index.search(query, 2);

      expect(results).toHaveLength(2);
      expect(results[0].recordId).toBe('rec_1');
      expect(results[1].recordId).toBe('rec_3');
    });

    it('should index and retrieve items in HNSW index', () => {
      const index = new HNSWVectorIndex('cosine');
      index.addBatch(records);

      const query = [1, 0, 0, 0];
      const results = index.search(query, 2);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].recordId).toBe('rec_1');
    });

    it('should cluster and retrieve items in IVF index', () => {
      const index = new IVFVectorIndex('cosine', { numLists: 2, nprobe: 2 });
      index.addBatch(records);

      const query = [1, 0, 0, 0];
      const results = index.search(query, 2);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('VectorStore Wrapper', () => {
    it('should store chunks and query vectors', async () => {
      const store = new VectorStore(new MockEmbeddingModel());
      const chunks: Chunk[] = [
        { id: 'c1', content: 'React rendering hooks', metadata: { documentId: 'd1', chunkIndex: 0, source: 't' } },
        { id: 'c2', content: 'Network timeout errors', metadata: { documentId: 'd2', chunkIndex: 0, source: 't' } }
      ];

      await store.addChunks(chunks);
      expect(store.size()).toBe(2);

      const results = await store.search('React hooks', 1);
      expect(results).toHaveLength(1);
      expect(results[0].chunk.id).toBeDefined();
    });
  });
});
