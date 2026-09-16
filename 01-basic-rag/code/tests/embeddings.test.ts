import { MockEmbeddingModel } from '../src/embeddings/mock';

describe('MockEmbeddingModel', () => {
  const embedder = new MockEmbeddingModel(32);

  test('dimension returns specified vector size', () => {
    expect(embedder.dimension()).toBe(32);
  });

  test('embedQuery generates normalized vector', async () => {
    const vec = await embedder.embedQuery('RAG Architecture');
    expect(vec).toHaveLength(32);
    // Check vector norm ~ 1.0
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  test('semantically identical texts have identical vectors', async () => {
    const vec1 = await embedder.embedQuery('Vector Database Similarity');
    const vec2 = await embedder.embedQuery('Vector Database Similarity');
    expect(vec1).toEqual(vec2);
  });
});
