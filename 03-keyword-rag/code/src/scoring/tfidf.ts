import { TFIDFParams, TermScoreDetail } from '../schemas';
import { calculateSmoothIDF } from './idf';
import { InvertedIndex } from '../index/inverted_index';

export class TFIDFScorer {
  private smoothIdf: boolean;
  private sublinearTf: boolean;

  constructor(params: TFIDFParams = { smoothIdf: true, sublinearTf: true }) {
    this.smoothIdf = params.smoothIdf ?? true;
    this.sublinearTf = params.sublinearTf ?? true;
  }

  /**
   * Computes TF-IDF score for a single query term against a document/chunk.
   */
  public scoreTerm(
    term: string,
    docId: string,
    index: InvertedIndex
  ): TermScoreDetail {
    const posting = index.getPosting(term, docId);
    const rawTf = posting ? posting.termFrequency : 0;

    if (rawTf === 0) {
      return {
        term,
        rawTf: 0,
        idf: 0,
        bm25Score: 0,
        tfidfScore: 0,
        scoreContribution: 0,
      };
    }

    const N = index.getTotalDocuments();
    const df = index.getDocumentFrequency(term);
    const idf = this.smoothIdf
      ? calculateSmoothIDF(N, df)
      : df > 0
      ? Math.log(N / df)
      : 0;

    const tfWeight = this.sublinearTf && rawTf > 0 ? 1 + Math.log(rawTf) : rawTf;
    const tfidfScore = tfWeight * idf;

    return {
      term,
      rawTf,
      idf,
      bm25Score: 0,
      tfidfScore,
      scoreContribution: tfidfScore,
    };
  }

  /**
   * Computes overall TF-IDF score for query terms against a document/chunk.
   */
  public scoreDocument(
    queryTerms: string[],
    docId: string,
    index: InvertedIndex
  ): { totalScore: number; details: TermScoreDetail[] } {
    let totalScore = 0;
    const details: TermScoreDetail[] = [];
    const uniqueTerms = Array.from(new Set(queryTerms));

    for (const term of uniqueTerms) {
      const detail = this.scoreTerm(term, docId, index);
      totalScore += detail.tfidfScore;
      details.push(detail);
    }

    return { totalScore, details };
  }
}
