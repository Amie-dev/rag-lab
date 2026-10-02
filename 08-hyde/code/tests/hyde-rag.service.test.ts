import { initializeSampleData } from '../src/app';
import { hydeRAGService } from '../src/services/hyde-rag.service';

describe('HyDERAGService', () => {
  beforeAll(async () => {
    await initializeSampleData();
  });

  it('should execute HyDE retrieval search successfully', async () => {
    const searchResult = await hydeRAGService.search({
      query: 'How does vector search improve RAG accuracy?',
      numHypotheticalDocs: 1,
      finalTopK: 3,
      enableReranking: true,
    });

    expect(searchResult).toBeDefined();
    expect(searchResult.hypotheticalDocuments.length).toBe(1);
    expect(searchResult.topContextChunks.length).toBeGreaterThan(0);
    expect(searchResult.totalCandidatesRetrieved).toBeGreaterThan(0);
  });

  it('should execute full end-to-end grounded HyDE RAG pipeline', async () => {
    const ragResult = await hydeRAGService.executeRAG({
      question: 'How does RAG reduce hallucinations?',
      numHypotheticalDocs: 1,
      finalTopK: 3,
    });

    expect(ragResult).toBeDefined();
    expect(ragResult.answer).toBeDefined();
    expect(ragResult.answer.length).toBeGreaterThan(10);
    expect(ragResult.confidenceScore).toBeGreaterThan(0);
    expect(ragResult.retrievedContext.length).toBeGreaterThan(0);
  });
});
