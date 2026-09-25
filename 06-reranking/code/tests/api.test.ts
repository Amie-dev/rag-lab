import request from 'supertest';
import { app } from '../src/app';
import { inMemoryVectorStore } from '../src/vectordb/in-memory-vector-store';

describe('Express REST API Endpoints', () => {
  beforeEach(() => {
    inMemoryVectorStore.clear();
  });

  it('GET /api/v1/health should return 200 OK', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('@rag-lab/reranking-rag');
  });

  it('POST /api/v1/documents/seed should load sample documents', async () => {
    const res = await request(app).post('/api/v1/documents/seed');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalDocuments).toBeGreaterThan(0);
  });

  it('POST /api/v1/documents/ingest should validate payload and store chunk', async () => {
    const res = await request(app)
      .post('/api/v1/documents/ingest')
      .send({
        content: 'Testing single document ingestion pipeline.',
        metadata: {
          title: 'Ingestion Test Document',
          category: 'test',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Ingestion Test Document');
  });

  it('POST /api/v1/search should return Two-Stage candidate search results', async () => {
    await request(app).post('/api/v1/documents/seed');

    const res = await request(app)
      .post('/api/v1/search')
      .send({
        query: 'How to reset account password?',
        stage1CandidateTopN: 5,
        stage2FinalTopK: 3,
        retrievalMode: 'hybrid',
        rerankerProvider: 'local',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rerankedResults.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/rag/query should return grounded answer and metrics', async () => {
    await request(app).post('/api/v1/documents/seed');

    const res = await request(app)
      .post('/api/v1/rag/query')
      .send({
        question: 'What is the refund policy?',
        stage1CandidateTopN: 5,
        stage2FinalTopK: 2,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.answer).toBeDefined();
    expect(res.body.citedChunkIds).toBeDefined();
  });

  it('POST /api/v1/benchmark/evaluate should run candidate sweep report', async () => {
    await request(app).post('/api/v1/documents/seed');

    const res = await request(app)
      .post('/api/v1/benchmark/evaluate')
      .send({
        queries: ['password reset'],
        candidateSizes: [2, 5],
        topK: 2,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.report.candidateSizeSweep).toHaveLength(2);
  });
});
