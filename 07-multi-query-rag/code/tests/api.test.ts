import request from 'supertest';
import { app } from '../src/app';
import { vectorStoreService } from '../src/services/vector-store.service';

describe('Express REST API Endpoints', () => {
  beforeAll(async () => {
    vectorStoreService.clear();
  });

  describe('GET /api/v1/health', () => {
    it('should return 200 OK with health status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('@rag-lab/multi-query-rag');
    });
  });

  describe('POST /api/v1/documents/ingest & /seed', () => {
    it('should ingest a document chunk', async () => {
      const res = await request(app).post('/api/v1/documents/ingest').send({
        content: 'JWT tokens expire after 15 minutes of inactivity.',
        metadata: { title: 'JWT Timeout' },
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.chunk.id).toBeTruthy();
    });

    it('should seed sample dataset', async () => {
      const res = await request(app).post('/api/v1/documents/seed').send();
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totalChunksInStore).toBeGreaterThan(0);
    });

    it('should list ingested document chunks', async () => {
      const res = await request(app).get('/api/v1/documents/list');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totalChunks).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/multi-query/generate', () => {
    it('should generate query variations', async () => {
      const res = await request(app).post('/api/v1/multi-query/generate').send({
        query: 'How to stop users from accessing protected pages after session expires?',
        numQueries: 4,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.variations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('POST /api/v1/multi-query/search', () => {
    it('should execute multi-query retrieval and deduplication', async () => {
      const res = await request(app).post('/api/v1/multi-query/search').send({
        query: 'How to handle session expiration?',
        numQueries: 3,
        topKPerQuery: 3,
        finalTopK: 3,
        fusionStrategy: 'rrf',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.generatedQueries.length).toBeGreaterThan(0);
      expect(res.body.mergedResults.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/rag/query', () => {
    it('should run end-to-end Multi-Query RAG pipeline', async () => {
      const res = await request(app).post('/api/v1/rag/query').send({
        question: 'What is our subscription refund policy?',
        numQueries: 3,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.answer).toBeTruthy();
      expect(res.body.confidenceScore).toBeGreaterThan(0);
      expect(res.body.citedChunkIds.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/benchmark/compare', () => {
    it('should run comparative benchmarks', async () => {
      const res = await request(app).post('/api/v1/benchmark/compare').send({
        queries: ['How to handle session timeout?'],
        numQueries: 3,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.testQueriesCount).toBe(1);
      expect(res.body.averageMetrics).toBeTruthy();
    });
  });
});
