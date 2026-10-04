import { embeddingService } from '../src/services/embedding.service';

describe('EmbeddingService', () => {
  it('generates a 1536-dimensional L2-normalized embedding vector', async () => {
    const embedding = await embeddingService.getEmbedding('How does vector search improve RAG?');
    expect(embedding.length).toBe(1536);

    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it('returns higher cosine similarity for semantically related texts', async () => {
    const query = 'How does Parent-Document RAG reduce context loss?';
    const related = 'Parent-Document RAG retrieves small child chunks but generates from large parent chunks to preserve context.';
    const unrelated = 'PostgreSQL composite B-Tree indexes speed up slow SQL queries.';

    const q = await embeddingService.getEmbedding(query);
    const r = await embeddingService.getEmbedding(related);
    const u = await embeddingService.getEmbedding(unrelated);

    expect(embeddingService.cosineSimilarity(q, r)).toBeGreaterThan(embeddingService.cosineSimilarity(q, u));
  });

  it('handles batch embedding generation', async () => {
    const embeddings = await embeddingService.getBatchEmbeddings(['first', 'second', 'third']);
    expect(embeddings.length).toBe(3);
    embeddings.forEach((emb) => expect(emb.length).toBe(1536));
    expect(await embeddingService.getBatchEmbeddings([])).toEqual([]);
  });
});
