import { vectorStoreService } from '../src/services/vector-store.service';
import { Document } from '../src/types';

describe('VectorStoreService', () => {
  beforeEach(() => {
    vectorStoreService.clear();
  });

  it('should chunk and ingest documents into vector store', async () => {
    const docs: Document[] = [
      {
        id: 'doc_1',
        content: 'Vector databases store high-dimensional embeddings and support similarity search algorithms like HNSW and IVF.',
        metadata: { title: 'Vector DB Architecture' },
      },
    ];

    const chunkCount = await vectorStoreService.ingestDocuments(docs);
    expect(chunkCount).toBeGreaterThan(0);
    expect(vectorStoreService.isReady()).toBe(true);
  });

  it('should retrieve top hits using dense vector similarity search', async () => {
    const docs: Document[] = [
      {
        id: 'doc_auth',
        content: 'JSON Web Tokens (JWT) are used for stateless API authorization with Redis blacklisting for token revocation.',
        metadata: { title: 'JWT Auth' },
      },
      {
        id: 'doc_db',
        content: 'PostgreSQL database query optimization requires adding indexes to heavily queried table columns.',
        metadata: { title: 'Postgres Indexing' },
      },
    ];

    await vectorStoreService.ingestDocuments(docs);

    const hits = await vectorStoreService.searchByText('JWT token session revocation auth', 2, 'direct_vector');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunk.documentId).toBe('doc_auth');
  });
});
