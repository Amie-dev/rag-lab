import { retrievalPipelineService } from '../src/services/retrieval-pipeline.service';
import { inMemoryVectorStore } from '../src/vectordb/in-memory-vector-store';
import { embeddingService } from '../src/services/embedding.service';
import { DocumentChunk, PipelineOptions } from '../src/types';

describe('RetrievalPipelineService', () => {
  beforeAll(async () => {
    inMemoryVectorStore.clear();

    const sampleDocs: DocumentChunk[] = [
      {
        id: 'doc-1',
        content: 'To reset your account password, navigate to Security -> Reset Password.',
        metadata: { title: 'Password Reset Procedure' },
      },
      {
        id: 'doc-2',
        content: 'General account settings allow updating profile username and avatar.',
        metadata: { title: 'Account Settings' },
      },
      {
        id: 'doc-3',
        content: 'Subscription billing refunds are issued within 14 days of purchase.',
        metadata: { title: 'Refund Policy' },
      },
    ];

    for (const doc of sampleDocs) {
      doc.embedding = await embeddingService.generateEmbedding(`${doc.metadata.title} ${doc.content}`);
      inMemoryVectorStore.upsertChunk(doc);
    }
  });

  it('should execute Two-Stage pipeline and calculate rank delta and latency metrics', async () => {
    const opts: PipelineOptions = {
      stage1CandidateTopN: 3,
      stage2FinalTopK: 2,
      retrievalMode: 'hybrid',
      rerankerProvider: 'local',
    };

    const res = await retrievalPipelineService.executePipeline('how to reset password', opts);

    expect(res.candidates.length).toBeGreaterThan(0);
    expect(res.rerankedResults.length).toBeLessThanOrEqual(2);
    expect(res.metrics.totalLatencyMs).toBeGreaterThanOrEqual(0);
    expect(res.rerankedResults[0].finalRank).toBe(1);
  });
});
