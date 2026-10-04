import { vectorStoreService } from '../src/services/vector-store.service';
import { ChildChunk } from '../src/types';

const makeChild = (id: string, parentId: string, content: string): ChildChunk => ({
  id,
  parentId,
  documentId: 'doc',
  content,
  chunkIndex: 0,
  totalChunks: 1,
  tokenEstimate: 10,
  metadata: { title: 'Test' },
});

describe('ChildVectorStoreService', () => {
  beforeEach(() => vectorStoreService.clear());

  it('ingests children and computes embeddings', async () => {
    const count = await vectorStoreService.ingestChildren([
      makeChild('c1', 'p1', 'JSON Web Tokens are used for authentication and sessions'),
      makeChild('c2', 'p2', 'PostgreSQL composite b-tree indexing improves query performance'),
    ]);

    expect(count).toBe(2);
    expect(vectorStoreService.isReady()).toBe(true);
    expect(vectorStoreService.getChildren()[0].embedding?.length).toBe(1536);
  });

  it('retrieves the most relevant child by text', async () => {
    await vectorStoreService.ingestChildren([
      makeChild('c1', 'p1', 'JSON Web Tokens are used for authentication and session management'),
      makeChild('c2', 'p2', 'PostgreSQL composite b-tree indexing improves slow query performance'),
    ]);

    const hits = await vectorStoreService.searchByText('authentication jwt token session', 2);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].child.parentId).toBe('p1');
    expect(hits[0].searchMethod).toBe('child_dense');
    expect(hits[0].rank).toBe(1);
  });

  it('returns no hits when the index is empty or the vector is invalid', async () => {
    expect(await vectorStoreService.ingestChildren([])).toBe(0);
    expect(vectorStoreService.isReady()).toBe(false);
    expect(vectorStoreService.searchByVector([], 5)).toEqual([]);
  });
});
