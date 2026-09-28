import { DocumentChunk, ScoredChunk } from '../types';

export class BM25Service {
  private k1: number = 1.2;
  private b: number = 0.75;

  /**
   * Simple standard English word tokenizer and stemmer/cleaner
   */
  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  /**
   * Scores document chunks against a query using Okapi BM25 formula.
   */
  scoreDocuments(query: string, chunks: DocumentChunk[]): ScoredChunk[] {
    if (chunks.length === 0) return [];

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) {
      return chunks.map((chunk) => ({ chunk, score: 0, retrievalType: 'bm25' }));
    }

    const docCount = chunks.length;
    const docTokens = chunks.map((c) => this.tokenize(c.content + ' ' + (c.metadata.title || '')));
    const avgDocLength = docTokens.reduce((acc, t) => acc + t.length, 0) / docCount || 1;

    // Document Frequency (DF) map
    const dfMap = new Map<string, number>();
    for (const tokens of docTokens) {
      const uniqueTokens = new Set(tokens);
      for (const t of uniqueTokens) {
        dfMap.set(t, (dfMap.get(t) || 0) + 1);
      }
    }

    const scored: ScoredChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const tokens = docTokens[i];
      const docLength = tokens.length;

      // Term Frequency (TF) map
      const tfMap = new Map<string, number>();
      for (const t of tokens) {
        tfMap.set(t, (tfMap.get(t) || 0) + 1);
      }

      let score = 0;

      for (const qTerm of queryTokens) {
        const tf = tfMap.get(qTerm) || 0;
        if (tf === 0) continue;

        const df = dfMap.get(qTerm) || 0;
        // IDF with smoothing
        const idf = Math.log((docCount - df + 0.5) / (df + 0.5) + 1);

        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / avgDocLength));

        score += idf * (numerator / denominator);
      }

      scored.push({
        chunk,
        score: Math.max(0, score),
        retrievalType: 'bm25',
      });
    }

    return scored;
  }
}

export const bm25Service = new BM25Service();
