import { TechnicalTextAnalyzer } from '../src/sparse/analyzer';
import { InvertedIndex } from '../src/sparse/inverted-index';
import { BM25Engine } from '../src/sparse/bm25';
import { Chunk } from '../src/schemas';

describe('Sparse Lexical Subsystem', () => {
  describe('TechnicalTextAnalyzer', () => {
    it('should preserve technical error codes, hex codes, and function signatures', () => {
      const analyzer = new TechnicalTextAnalyzer();
      const text = 'Encountered ERR_CONNECTION_TIMED_OUT and 0x80004005 in createPaymentIntent with SKU TX-9021-B.';

      const tokens = analyzer.tokenize(text);
      const terms = tokens.map((t) => t.term);

      expect(terms).toContain('err_connection_timed_out');
      expect(terms).toContain('0x80004005');
      expect(terms).toContain('createpaymentintent');
      expect(terms).toContain('tx-9021-b');
    });

    it('should filter standard stop words while keeping technical terms', () => {
      const analyzer = new TechnicalTextAnalyzer();
      const text = 'The system is in an error state with ERR_CONNECTION_TIMED_OUT.';

      const terms = analyzer.extractTerms(text);
      expect(terms).not.toContain('the');
      expect(terms).not.toContain('is');
      expect(terms).not.toContain('in');
      expect(terms).toContain('err_connection_timed_out');
    });
  });

  describe('Inverted Index & BM25 Scoring', () => {
    const chunks: Chunk[] = [
      {
        id: 'chunk_1',
        content: 'Troubleshooting guide for ERR_CONNECTION_TIMED_OUT when NGINX returns 504 Gateway Timeout.',
        metadata: { documentId: 'doc_1', chunkIndex: 0, source: 'test' }
      },
      {
        id: 'chunk_2',
        content: 'Stripe API reference guide for createPaymentIntent function and payment gateway integration.',
        metadata: { documentId: 'doc_2', chunkIndex: 0, source: 'test' }
      },
      {
        id: 'chunk_3',
        content: 'React performance optimization using useMemo and useEffect hooks for rendering.',
        metadata: { documentId: 'doc_3', chunkIndex: 0, source: 'test' }
      }
    ];

    it('should build postings list and compute correct document statistics', () => {
      const index = new InvertedIndex();
      index.addChunks(chunks);

      const stats = index.getStats();
      expect(stats.totalDocuments).toBe(3);
      expect(stats.vocabularySize).toBeGreaterThan(5);
      expect(index.getDocFrequency('err_connection_timed_out')).toBe(1);
    });

    it('should score and retrieve exact matching chunk using BM25', () => {
      const index = new InvertedIndex();
      index.addChunks(chunks);
      const bm25 = new BM25Engine(index);

      const results = bm25.search('ERR_CONNECTION_TIMED_OUT', 1);

      expect(results).toHaveLength(1);
      expect(results[0].chunk.id).toBe('chunk_1');
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].matchedTerms).toContain('err_connection_timed_out');
    });
  });
});
