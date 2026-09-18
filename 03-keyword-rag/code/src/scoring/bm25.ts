import { BM25Params, TermScoreDetail } from '../schemas';
import { calculateBM25IDF } from './idf';
import { InvertedIndex } from '../index/inverted_index';

export class BM25Scorer {
  private k1: number;
  private b: number;
  private epsilon: number;

  constructor(params: BM25Params = { k1: 1.5, b: 0.75, epsilon: 0.25 }) {
    this.k1 = params.k1;
    this.b = params.b;
    this.epsilon = params.epsilon ?? 0.25;
  }

  /**
   * Computes BM25 score for a given query term against a document/chunk.
   */
  public scoreTerm(
    term: string,
    docId: string,
    index: InvertedIndex
  ): TermScoreDetail {
    const posting = index.getPosting(term, docId);
    const rawTf = posting ? posting.termFrequency : 0;

    const N = index.getTotalDocuments();
    const df = index.getDocumentFrequency(term);
    const idf = calculateBM25IDF(N, df, this.epsilon);

    if (rawTf === 0 || idf === 0) {
      return {
        term,
        rawTf,
        idf,
        bm25Score: 0,
        tfidfScore: 0,
        scoreContribution: 0,
      };
    }

    const docLen = index.getDocLength(docId);
    const avgdl = index.getAvgDocLength();
    const lenNorm = avgdl > 0 ? 1 - this.b + this.b * (docLen / avgdl) : 1;

    // BM25 term weight calculation
    const tfSat = (rawTf * (this.k1 + 1)) / (rawTf + this.k1 * lenNorm);
    const bm25Score = idf * tfSat;

    return {
      term,
      rawTf,
      idf,
      bm25Score,
      tfidfScore: 0,
      scoreContribution: bm25Score,
    };
  }

  /**
   * Computes overall BM25 score for a collection of query terms against a document/chunk.
   */
  public scoreDocument(
    queryTerms: string[],
    docId: string,
    index: InvertedIndex
  ): { totalScore: number; details: TermScoreDetail[] } {
    let totalScore = 0;
    const details: TermScoreDetail[] = [];

    // Deduplicate query terms while summing weights if appropriate
    const uniqueTerms = Array.from(new Set(queryTerms));

    for (const term of uniqueTerms) {
      const detail = this.scoreTerm(term, docId, index);
      totalScore += detail.bm25Score;
      details.push(detail);
    }

    return { totalScore, details };
  }
}
