import { BasicRAGPipeline } from '../src/pipeline/basicRag';

describe('BasicRAGPipeline End-to-End', () => {
  let pipeline: BasicRAGPipeline;

  beforeEach(() => {
    pipeline = new BasicRAGPipeline({
      chunkSize: 100,
      chunkOverlap: 20,
      topK: 2,
      embeddingProvider: 'mock',
      llmProvider: 'mock',
    });
  });

  test('ingests content and queries basic RAG system', async () => {
    const ingestRes = await pipeline.ingest(
      'Basic RAG connects a document ingestion pipeline to a vector store. It retrieves top-K relevant chunks for user questions and generates answers using LLM.'
    );

    expect(ingestRes.documents).toHaveLength(1);
    expect(ingestRes.chunks.length).toBeGreaterThan(0);
    expect(await pipeline.getIndexedChunkCount()).toBe(ingestRes.chunks.length);

    const response = await pipeline.query('What is Basic RAG?');
    expect(response.question).toBe('What is Basic RAG?');
    expect(response.contextChunks).toHaveLength(2);
    expect(response.answer).toContain('Basic RAG');
    expect(response.metadata.model).toBe('mock-llm-v1');
    expect(response.metadata.totalLatencyMs).toBeGreaterThanOrEqual(0);
  });
});
