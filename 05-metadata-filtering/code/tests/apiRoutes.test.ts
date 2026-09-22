import request from 'supertest';
import { createApp } from '../src/app';
import { RAGService } from '../src/services/ragService';

describe('Express API Integration Tests', () => {
  let app: ReturnType<typeof createApp>;
  let ragService: RAGService;

  beforeEach(async () => {
    ragService = new RAGService();
    app = createApp(ragService);

    // Ingest test document
    await ragService.ingestDocument({
      id: 'doc_api_test_1',
      content: 'Tenant 101 enterprise finance policy for software subscription refunds.',
      metadata: {
        tenant_id: 'tenant_101',
        department: 'finance',
        file_type: 'pdf',
        access_level: 2,
      },
    });
  });

  test('GET /api/v1/health - should return system status and stats', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.databaseStats.totalRecords).toBeGreaterThan(0);
  });

  test('POST /api/v1/documents/ingest - should ingest a document', async () => {
    const res = await request(app)
      .post('/api/v1/documents/ingest')
      .send({
        content: 'Tenant 101 engineering specification for REST API rate limits.',
        metadata: {
          tenant_id: 'tenant_101',
          department: 'engineering',
          file_type: 'md',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.documentId).toBeDefined();
    expect(res.body.data.chunksCreated).toBeGreaterThan(0);
  });

  test('POST /api/v1/search - should perform pre-filtered vector search', async () => {
    const res = await request(app)
      .post('/api/v1/search')
      .set('x-tenant-id', 'tenant_101')
      .set('x-department', 'finance')
      .send({
        query: 'refund policy',
        mode: 'pre-filter',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.results.length).toBeGreaterThan(0);
    expect(res.body.data.results[0].chunk.metadata.tenant_id).toBe('tenant_101');
  });

  test('POST /api/v1/rag/query - should execute RAG pipeline and generate answer', async () => {
    const res = await request(app)
      .post('/api/v1/rag/query')
      .set('x-tenant-id', 'tenant_101')
      .set('x-department', 'finance')
      .send({
        question: 'What is our refund policy?',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.answer).toBeDefined();
    expect(res.body.data.retrievedChunks.length).toBeGreaterThan(0);
  });

  test('POST /api/v1/benchmark/filter-comparison - should run comparison report', async () => {
    const res = await request(app)
      .post('/api/v1/benchmark/filter-comparison')
      .send({
        query: 'refund policy',
        filter: { tenant_id: 'tenant_101' },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.preFilter).toBeDefined();
    expect(res.body.data.postFilterRuns).toBeDefined();
  });
});
