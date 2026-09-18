import * as path from 'path';
import { KeywordRAGPipeline } from '../src/pipeline/rag_pipeline';
import { MockLLMProvider } from '../src/llm/mock';

describe('Keyword RAG Pipeline Integration', () => {
  let pipeline: KeywordRAGPipeline;

  beforeEach(() => {
    pipeline = new KeywordRAGPipeline({
      analyzerType: 'technical',
      scoringAlgorithm: 'bm25',
      llmProvider: new MockLLMProvider(),
    });
  });

  test('Ingests file and executes end-to-end RAG query', async () => {
    const filePath = path.join(__dirname, '../sample_data/technical_docs.md');
    const chunks = await pipeline.ingestFile(filePath);

    expect(chunks.length).toBeGreaterThan(0);

    const response = await pipeline.query('What causes ERR_CONNECTION_TIMED_OUT?', {
      topK: 2,
    });

    expect(response.question).toBe('What causes ERR_CONNECTION_TIMED_OUT?');
    expect(response.contextChunks.length).toBeGreaterThan(0);
    expect(response.answer).toContain('ERR_CONNECTION_TIMED_OUT');
    expect(response.metadata.algorithm).toBe('bm25');
  });
});
