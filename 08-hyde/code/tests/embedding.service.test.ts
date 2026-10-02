import { embeddingService } from '../src/services/embedding.service';

describe('EmbeddingService', () => {
  it('should generate a 1536-dimensional L2 normalized embedding vector', async () => {
    const text = 'How does vector search improve RAG?';
    const embedding = await embeddingService.getEmbedding(text);

    expect(embedding).toBeDefined();
    expect(embedding.length).toBe(1536);

    // Verify L2 Norm equals ~1.0
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it('should return higher cosine similarity for semantically related texts', async () => {
    const query = 'How does RAG reduce hallucinations?';
    const relatedDoc = 'Retrieval-Augmented Generation grounds LLM answers in retrieved documents to eliminate hallucination.';
    const unrelatedDoc = 'PostgreSQL database composite B-Tree indexes speed up SQL queries.';

    const qEmbed = await embeddingService.getEmbedding(query);
    const relEmbed = await embeddingService.getEmbedding(relatedDoc);
    const unrelEmbed = await embeddingService.getEmbedding(unrelatedDoc);

    const simRelated = embeddingService.cosineSimilarity(qEmbed, relEmbed);
    const simUnrelated = embeddingService.cosineSimilarity(qEmbed, unrelEmbed);

    expect(simRelated).toBeGreaterThan(simUnrelated);
  });

  it('should handle batch embedding generation', async () => {
    const texts = ['First paragraph', 'Second paragraph', 'Third paragraph'];
    const embeddings = await embeddingService.getBatchEmbeddings(texts);

    expect(embeddings.length).toBe(3);
    embeddings.forEach((emb) => {
      expect(emb.length).toBe(1536);
    });
  });
});
