import request from 'supertest';
import { createApp } from '../src/app';

describe('HyDE REST API Endpoints', () => {
  let app: any;

  beforeAll(async () => {
    app = await createApp();
  });

  it('GET /api/v1/hyde/health should return health status', async () => {
    const res = await request(app).get('/api/v1/hyde/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.vectorStoreReady).toBe(true);
  });

  it('POST /api/v1/hyde/generate-hypothetical should generate hypothetical document preview', async () => {
    const res = await request(app).post('/api/v1/hyde/generate-hypothetical').send({
      query: 'How does vector search improve RAG?',
      numDocs: 1,
      domainContext: 'technical',
    });

    expect(res.status).toBe(200);
    expect(res.body.hypotheticalDocuments).toBeDefined();
    expect(res.body.hypotheticalDocuments.length).toBe(1);
  });

  it('POST /api/v1/hyde/search should perform HyDE vector retrieval', async () => {
    const res = await request(app).post('/api/v1/hyde/search').send({
      query: 'How does RAG reduce hallucinations?',
      numHypotheticalDocs: 1,
      finalTopK: 3,
    });

    expect(res.status).toBe(200);
    expect(res.body.topContextChunks).toBeDefined();
  });

  it('POST /api/v1/hyde/rag should return grounded RAG response', async () => {
    const res = await request(app).post('/api/v1/hyde/rag').send({
      question: 'How does RAG reduce hallucinations?',
      numHypotheticalDocs: 1,
      finalTopK: 3,
    });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
    expect(res.body.confidenceScore).toBeDefined();
  });

  it('POST /api/v1/hyde/benchmark should return comparative metrics', async () => {
    const res = await request(app).post('/api/v1/hyde/benchmark').send({
      topK: 3,
    });

    expect(res.status).toBe(200);
    expect(res.body.metricsPerStrategy).toBeDefined();
  });
});
