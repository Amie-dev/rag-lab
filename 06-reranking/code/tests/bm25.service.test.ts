import { BM25Service } from '../src/services/bm25.service';
import { DocumentChunk } from '../src/types';

describe('BM25Service', () => {
  let bm25Service: BM25Service;

  beforeEach(() => {
    bm25Service = new BM25Service();
  });

  it('should correctly tokenize text into normalized terms', () => {
    const text = 'Reset account password & Multi-Factor Authentication!';
    const tokens = bm25Service.tokenize(text);
    expect(tokens).toEqual(['reset', 'account', 'password', 'multi', 'factor', 'authentication']);
  });

  it('should rank documents with higher term frequency and matching terms higher', () => {
    const docs: DocumentChunk[] = [
      {
        id: '1',
        content: 'Password reset guide. Follow these steps to reset your password.',
        metadata: { title: 'Password Reset' },
      },
      {
        id: '2',
        content: 'General account settings and user profile updates.',
        metadata: { title: 'Account Settings' },
      },
    ];

    const scores = bm25Service.scoreDocuments('password reset', docs);

    expect(scores.get('1')).toBeGreaterThan(scores.get('2') || 0);
  });

  it('should return empty map for empty queries or empty document arrays', () => {
    const scores = bm25Service.scoreDocuments('', []);
    expect(scores.size).toBe(0);
  });
});
