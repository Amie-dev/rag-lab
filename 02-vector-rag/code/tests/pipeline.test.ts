import { VectorRAGPipeline } from '../src/pipeline/vectorRag';

describe('VectorRAGPipeline Facade Suite', () => {
  it('should ingest text and answer question using mock embedder and mock LLM', async () => {
    const pipeline = new VectorRAGPipeline({
      indexType: 'hnsw',
      topK: 2,
      embeddingProvider: 'mock',
      llmProvider: 'mock',
    });

    const stats = await pipeline.ingest(`
      Domestic cat care involves providing high quality feline nutrition, fresh water, and regular veterinary checkups.
      Cats need interactive toys and scratching posts for indoor environmental enrichment.
    `);

    expect(stats.numDocuments).toBe(1);
    expect(stats.numChunks).toBeGreaterThan(0);

    const response = await pipeline.query('How do I take care of a domestic cat?');

    expect(response.question).toBe('How do I take care of a domestic cat?');
    expect(response.contextChunks.length).toBeGreaterThan(0);
    expect(response.answer).toContain('Vector retrieval identified');
    expect(response.metadata.indexType).toBe('hnsw');
  });
});
