import { DocumentChunk, SearchHit } from '../types';

export class BM25Service {
  private k1: number = 1.2;
  private b: number = 0.75;

  /**
   * Evaluates BM25 sparse keyword similarity scores across a set of document chunks.
   */
  search(query: string, chunks: DocumentChunk[], topK: number = 5): SearchHit[] {
    if (chunks.length === 0 || !query.trim()) return [];

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const numDocs = chunks.length;
    const docTokenCounts: Map<string, number> = new Map();
    const docTokenFreqs: Map<string, Map<string, number>> = new Map();

    let totalDocLength = 0;

    // Tokenize and build document statistics
    for (const chunk of chunks) {
      const tokens = this.tokenize(chunk.content + ' ' + (chunk.metadata.title || ''));
      docTokenCounts.set(chunk.id, tokens.length);
      totalDocLength += tokens.length;

      const freqs = new Map<string, number>();
      for (const t of tokens) {
        freqs.set(t, (freqs.get(t) || 0) + 1);
      }
      docTokenFreqs.set(chunk.id, freqs);
    }

    const avgDocLength = totalDocLength / numDocs || 1;

    // Calculate document frequencies (df) for query tokens
    const docFreqs: Map<string, number> = new Map();
    for (const qToken of queryTokens) {
      let count = 0;
      for (const chunk of chunks) {
        const freqs = docTokenFreqs.get(chunk.id);
        if (freqs && freqs.has(qToken)) {
          count++;
        }
      }
      docFreqs.set(qToken, count);
    }

    // Calculate BM25 score per chunk
    const hits: SearchHit[] = [];

    for (const chunk of chunks) {
      const docLen = docTokenCounts.get(chunk.id) || 0;
      const freqs = docTokenFreqs.get(chunk.id);
      let score = 0;

      for (const qToken of queryTokens) {
        const tf = freqs?.get(qToken) || 0;
        if (tf === 0) continue;

        const df = docFreqs.get(qToken) || 0;

        // Inverse Document Frequency (IDF) calculation with smoothing
        const idf = Math.log(1 + (numDocs - df + 0.5) / (df + 0.5));

        // Term Frequency component with length normalization
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / avgDocLength));

        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        hits.push({
          chunk,
          score,
          searchMethod: 'bm25',
        });
      }
    }

    // Sort descending by BM25 score
    hits.sort((a, b) => b.score - a.score);

    return hits.slice(0, topK);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }
}

export const bm25Service = new BM25Service();
