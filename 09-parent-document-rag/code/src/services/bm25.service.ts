import { ChildChunk, ChildSearchHit } from '../types';

/**
 * BM25Service provides sparse lexical retrieval over CHILD chunks.
 *
 * Combining BM25 with dense retrieval (hybrid search) materially improves
 * recall for exact terms such as product IDs, error codes, names, and legal
 * terminology that child chunks may otherwise under-represent in vector space.
 */
export class BM25Service {
  private k1: number = 1.2;
  private b: number = 0.75;

  /**
   * Scores and ranks child chunks against a query using Okapi BM25.
   */
  search(query: string, children: ChildChunk[], topK: number = 10): ChildSearchHit[] {
    if (children.length === 0 || !query.trim()) return [];

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const numDocs = children.length;
    const docTokenCounts: Map<string, number> = new Map();
    const docTokenFreqs: Map<string, Map<string, number>> = new Map();

    let totalDocLength = 0;

    for (const child of children) {
      const tokens = this.tokenize(`${child.content} ${child.metadata.title || ''}`);
      docTokenCounts.set(child.id, tokens.length);
      totalDocLength += tokens.length;

      const freqs = new Map<string, number>();
      for (const t of tokens) {
        freqs.set(t, (freqs.get(t) || 0) + 1);
      }
      docTokenFreqs.set(child.id, freqs);
    }

    const avgDocLength = totalDocLength / numDocs || 1;

    // Document frequency (df) for each query token.
    const docFreqs: Map<string, number> = new Map();
    for (const qToken of queryTokens) {
      let count = 0;
      for (const child of children) {
        const freqs = docTokenFreqs.get(child.id);
        if (freqs && freqs.has(qToken)) count++;
      }
      docFreqs.set(qToken, count);
    }

    const scored: Array<{ child: ChildChunk; score: number }> = [];

    for (const child of children) {
      const docLen = docTokenCounts.get(child.id) || 0;
      const freqs = docTokenFreqs.get(child.id);
      let score = 0;

      for (const qToken of queryTokens) {
        const tf = freqs?.get(qToken) || 0;
        if (tf === 0) continue;

        const df = docFreqs.get(qToken) || 0;
        const idf = Math.log(1 + (numDocs - df + 0.5) / (df + 0.5));
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / avgDocLength));
        score += idf * (numerator / denominator);
      }

      if (score > 0) scored.push({ child, score });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((entry, idx) => ({
      child: entry.child,
      score: entry.score,
      searchMethod: 'child_bm25' as const,
      rank: idx + 1,
    }));
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
