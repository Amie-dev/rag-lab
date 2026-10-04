import request from 'supertest';
import { createApp } from '../src/app';

describe('Parent-Document RAG REST API', () => {
  let app: any;

  beforeAll(async () => {
    app = await createApp();
  });

  it('GET /health returns service and knowledge-base status', async () => {
    const res = await request(app).get('/api/v1/parent-document/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.knowledgeBaseReady).toBe(true);
    expect(res.body.totalChildren).toBeGreaterThan(0);
    expect(res.body.totalParents).toBeGreaterThan(0);
  });

  it('GET /documents lists indexed child chunks', async () => {
    const res = await request(app).get('/api/v1/parent-document/documents');
    expect(res.status).toBe(200);
    expect(res.body.children.length).toBeGreaterThan(0);
    expect(res.body.children[0].parentId).toBeDefined();
  });

  it('GET /parents lists parent contexts', async () => {
    const res = await request(app).get('/api/v1/parent-document/parents');
    expect(res.status).toBe(200);
    expect(res.body.totalParents).toBeGreaterThan(0);
    expect(res.body.parents[0].childCount).toBeGreaterThan(0);
  });

  it('POST /search returns child candidates and resolved parent contexts', async () => {
    const res = await request(app)
      .post('/api/v1/parent-document/search')
      .send({ query: 'How many sick leaves can an employee take?', maxParents: 3 });

    expect(res.status).toBe(200);
    expect(res.body.childCandidates.length).toBeGreaterThan(0);
    expect(res.body.resolution.parentContexts.length).toBeGreaterThan(0);
  });

  it('POST /rag returns a grounded answer built from parents', async () => {
    const res = await request(app)
      .post('/api/v1/parent-document/rag')
      .send({ question: 'When is the subscription renewed automatically?', maxParents: 3 });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
    expect(res.body.confidenceScore).toBeDefined();
    expect(res.body.parentContexts.length).toBeGreaterThan(0);
  });

  it('POST /benchmark returns comparative metrics', async () => {
    const res = await request(app).post('/api/v1/parent-document/benchmark').send({ childTopK: 5 });
    expect(res.status).toBe(200);
    expect(res.body.metricsPerStrategy).toBeDefined();
    expect(Object.keys(res.body.metricsPerStrategy).length).toBe(3);
  });

  it('POST /documents/ingest validates and ingests documents', async () => {
    const res = await request(app)
      .post('/api/v1/parent-document/documents/ingest')
      .send({
        documents: [
          {
            id: 'doc_quantum_widgets',
            content:
              'Quantum widget calibration procedures require cryogenic cooling and precise magnetometer alignment. Operators must verify the flux capacitor tolerance before each run. ' +
              'Calibration logs are retained for audit for a period of seven years according to internal quality standards.',
            metadata: { title: 'Quantum Widgets' },
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.childrenCreated).toBeGreaterThan(0);
    expect(res.body.parentsCreated).toBeGreaterThan(0);
  });

  it('POST /documents/ingest rejects an empty documents array', async () => {
    const res = await request(app).post('/api/v1/parent-document/documents/ingest').send({ documents: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });
});
