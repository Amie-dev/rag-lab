import { DocumentChunk } from '../types';

export class BM25Service {
  private k1: number;
  private b: number;

  constructor(k1 = 1.2, b = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  /**
   * Tokenizes text into lowercase normalized terms.
   */
  public tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  /**
   * Computes BM25 scores for a collection of document chunks given a query string.
   */
  public scoreDocuments(query: string, documents: DocumentChunk[]): Map<string, number> {
    const scores = new Map<string, number>();
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0 || documents.length === 0) {
      return scores;
    }

    // Precalculate doc tokens and lengths
    const docTokensMap = new Map<string, string[]>();
    let totalLength = 0;

    for (const doc of documents) {
      const tokens = this.tokenize(`${doc.metadata?.title || ''} ${doc.content}`);
      docTokensMap.set(doc.id, tokens);
      totalLength += tokens.length;
    }

    const avgDocLength = totalLength / documents.length || 1;
    const N = documents.length;

    // Document Frequency (DF) for each query term
    const dfMap = new Map<string, number>();
    for (const term of queryTokens) {
      let count = 0;
      for (const [, tokens] of docTokensMap) {
        if (tokens.includes(term)) {
          count++;
        }
      }
      dfMap.set(term, count);
    }

    // Calculate BM25 score for each document
    for (const doc of documents) {
      const docTokens = docTokensMap.get(doc.id) || [];
      const docLength = docTokens.length;

      // Term Frequencies (TF)
      const tfMap = new Map<string, number>();
      for (const token of docTokens) {
        tfMap.set(token, (tfMap.get(token) || 0) + 1);
      }

      let score = 0;
      for (const term of queryTokens) {
        const tf = tfMap.get(term) || 0;
        if (tf === 0) continue;

        const df = dfMap.get(term) || 0;
        // Inverse Document Frequency (IDF) with smoothing
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / avgDocLength));

        score += idf * (numerator / denominator);
      }

      scores.set(doc.id, score);
    }

    return scores;
  }
}

export const bm25Service = new BM25Service();
