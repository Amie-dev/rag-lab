import { MemoryVectorStore } from '../src/vectordb/memoryVectorStore';
import { VectorRecord } from '../src/types/document.types';

describe('MemoryVectorStore - Pre-Filtering vs Post-Filtering', () => {
  let store: MemoryVectorStore;

  // Simple 4D dummy vectors for predictable cosine similarity testing
  // Query vector: [1, 0, 0, 0]
  const records: VectorRecord[] = [
    {
      id: 'rec_tenantA_1',
      vector: [0.9, 0.1, 0, 0], // High similarity to query
      chunk: {
        id: 'c1',
        content: 'Tenant A high similarity doc',
        metadata: { document_id: 'd1', chunk_index: 0, tenant_id: 'tenant_A', department: 'finance' },
      },
      metadata: { document_id: 'd1', chunk_index: 0, tenant_id: 'tenant_A', department: 'finance' },
    },
    {
      id: 'rec_tenantB_1',
      vector: [0.99, 0.01, 0, 0], // Highest global similarity, but tenant_B
      chunk: {
        id: 'c2',
        content: 'Tenant B highest global similarity doc',
        metadata: { document_id: 'd2', chunk_index: 0, tenant_id: 'tenant_B', department: 'finance' },
      },
      metadata: { document_id: 'd2', chunk_index: 0, tenant_id: 'tenant_B', department: 'finance' },
    },
    {
      id: 'rec_tenantB_2',
      vector: [0.95, 0.05, 0, 0], // 2nd highest global similarity, but tenant_B
      chunk: {
        id: 'c3',
        content: 'Tenant B 2nd highest global doc',
        metadata: { document_id: 'd3', chunk_index: 0, tenant_id: 'tenant_B', department: 'finance' },
      },
      metadata: { document_id: 'd3', chunk_index: 0, tenant_id: 'tenant_B', department: 'finance' },
    },
  ];

  beforeEach(() => {
    store = new MemoryVectorStore();
    store.addRecords(records);
  });

  test('Pre-filtering should successfully retrieve Tenant A document despite higher Tenant B vectors', () => {
    const queryVector = [1, 0, 0, 0];
    const filter = { tenant_id: 'tenant_A' };

    const res = store.searchPreFiltered(queryVector, filter, 1);

    expect(res.results.length).toBe(1);
    expect(res.results[0].chunk.metadata.tenant_id).toBe('tenant_A');
    expect(res.results[0].recordId).toBe('rec_tenantA_1');
  });

  test('Post-filtering should suffer candidate starvation if global top-N limit excludes Tenant A', () => {
    const queryVector = [1, 0, 0, 0];
    const filter = { tenant_id: 'tenant_A' };

    // Limit post-filtering to top-2 global vectors. Top 2 are both tenant_B!
    const res = store.searchPostFiltered(queryVector, filter, 1, 2);

    expect(res.results.length).toBe(0); // Starvation! Zero results returned.
  });
});
