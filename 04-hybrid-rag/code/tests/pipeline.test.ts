import { HybridRAGPipeline } from '../src/pipeline/hybrid-pipeline';
import { Document } from '../src/schemas';

describe('Hybrid RAG Pipeline Integration', () => {
  const documents: Document[] = [
    {
      id: 'doc_tech',
      content:
        '# Technical Guide\n\n## Section 1\nError Code ERR_CONNECTION_TIMED_OUT occurs when network security rules block TCP port 443.',
      metadata: { source: 'tech.md', filename: 'tech.md' }
    },
    {
      id: 'doc_react',
      content:
        '# React Performance\n\n## Section 2\nUse useMemo hook to memoize expensive computations and maintain high FPS rendering.',
      metadata: { source: 'react.md', filename: 'react.md' }
    }
  ];

  it('should index documents into both Dense and Sparse indexes', async () => {
    const pipeline = new HybridRAGPipeline();
    const count = await pipeline.indexDocuments(documents);

    expect(count).toBeGreaterThan(0);
    expect(pipeline.size()).toBe(count);
  });

  it('should perform hybrid search and combine candidates using RRF', async () => {
    const pipeline = new HybridRAGPipeline();
    await pipeline.indexDocuments(documents);

    const results = await pipeline.search('ERR_CONNECTION_TIMED_OUT in network', {
      topK: 2,
      fusionStrategy: 'rrf'
    });

    expect(results).toHaveLength(2);
    expect(results[0].explanation.strategyUsed).toBe('rrf');
    expect(results[0].finalScore).toBeGreaterThan(0);
  });

  it('should generate complete RAG response with metadata and latency', async () => {
    const pipeline = new HybridRAGPipeline();
    await pipeline.indexDocuments(documents);

    const response = await pipeline.answer('How to resolve ERR_CONNECTION_TIMED_OUT?', { topK: 1 });

    expect(response.question).toBe('How to resolve ERR_CONNECTION_TIMED_OUT?');
    expect(response.answer).toBeDefined();
    expect(response.contextChunks).toHaveLength(1);
    expect(response.metadata.retrievalLatencyMs).toBeGreaterThanOrEqual(0);
    expect(response.metadata.generationLatencyMs).toBeGreaterThanOrEqual(0);
  });
});
