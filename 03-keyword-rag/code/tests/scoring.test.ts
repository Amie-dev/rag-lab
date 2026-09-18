import { InvertedIndex } from '../src/index/inverted_index';
import { TechnicalAnalyzer } from '../src/analysis/analyzer';
import { BM25Scorer } from '../src/scoring/bm25';
import { TFIDFScorer } from '../src/scoring/tfidf';
import { calculateBM25IDF, calculateSmoothIDF } from '../src/scoring/idf';
import { Chunk } from '../src/schemas';

describe('Scoring Algorithms (BM25 & TF-IDF)', () => {
  let index: InvertedIndex;
  let analyzer: TechnicalAnalyzer;

  beforeEach(() => {
    index = new InvertedIndex();
    analyzer = new TechnicalAnalyzer();

    const chunks: Chunk[] = [
      {
        id: 'doc1',
        content: 'Error ERR_CONNECTION_TIMED_OUT occurred while connecting to database cluster',
        metadata: { documentId: 'doc1', chunkIndex: 0, source: 'sys.log' },
      },
      {
        id: 'doc2',
        content: 'Database connection pool optimization guidelines and timeout settings',
        metadata: { documentId: 'doc2', chunkIndex: 0, source: 'db.md' },
      },
      {
        id: 'doc3',
        content: 'Unrelated document describing frontend UI React state management hooks',
        metadata: { documentId: 'doc3', chunkIndex: 0, source: 'react.md' },
      },
    ];

    for (const chunk of chunks) {
      index.addChunk(chunk, analyzer.analyze(chunk.content));
    }
  });

  test('BM25 IDF calculation produces higher scores for rare terms', () => {
    const rareIdf = calculateBM25IDF(index.getTotalDocuments(), index.getDocumentFrequency('err_connection_timed_out'));
    const commonIdf = calculateBM25IDF(index.getTotalDocuments(), index.getDocumentFrequency('databas'));

    expect(rareIdf).toBeGreaterThan(commonIdf);
  });

  test('BM25Scorer scores relevant documents higher than irrelevant ones', () => {
    const scorer = new BM25Scorer({ k1: 1.5, b: 0.75 });
    const queryTerms = ['err_connection_timed_out', 'database'];

    const doc1Score = scorer.scoreDocument(queryTerms, 'doc1', index).totalScore;
    const doc3Score = scorer.scoreDocument(queryTerms, 'doc3', index).totalScore;

    expect(doc1Score).toBeGreaterThan(0);
    expect(doc3Score).toBe(0);
  });

  test('TFIDFScorer produces non-zero scores for matching documents', () => {
    const scorer = new TFIDFScorer({ smoothIdf: true, sublinearTf: true });
    const queryTerms = ['database'];

    const doc1Result = scorer.scoreDocument(queryTerms, 'doc1', index);
    const doc2Result = scorer.scoreDocument(queryTerms, 'doc2', index);

    expect(doc1Result.totalScore).toBeGreaterThan(0);
    expect(doc2Result.totalScore).toBeGreaterThan(0);
  });
});
