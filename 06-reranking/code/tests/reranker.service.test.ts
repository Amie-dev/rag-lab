import { RerankerService } from '../src/services/reranker.service';
import { DocumentChunk } from '../src/types';

describe('RerankerService', () => {
  let rerankerService: RerankerService;

  beforeEach(() => {
    rerankerService = new RerankerService();
  });

  it('should rank exact intent matching document above broadly related candidate', async () => {
    const candidates: DocumentChunk[] = [
      {
        id: 'doc-broad',
        content: 'Users can edit account email addresses and profile notification settings.',
        metadata: { title: 'Account Settings' },
      },
      {
        id: 'doc-exact',
        content: 'To reset your account password, open Settings -> Security -> Reset Password.',
        metadata: { title: 'Password Reset Guide' },
      },
    ];

    const results = await rerankerService.rerank(
      'How do I reset my account password?',
      candidates,
      'local'
    );

    const docExactResult = results.find((r) => r.chunk.id === 'doc-exact');
    const docBroadResult = results.find((r) => r.chunk.id === 'doc-broad');

    expect(docExactResult).toBeDefined();
    expect(docBroadResult).toBeDefined();
    expect(docExactResult!.score).toBeGreaterThan(docBroadResult!.score);
  });

  it('should handle empty candidates array gracefully', async () => {
    const results = await rerankerService.rerank('query', [], 'local');
    expect(results).toEqual([]);
  });
});
