import { SparseRetrievalResult } from '../schemas';
import { InvertedIndex } from './inverted-index';

export interface BM25Config {
  k1?: number; // Term frequency saturation parameter (default: 1.5)
  b?: number;  // Document length normalization parameter (default: 0.75)
}

export class BM25Engine {
  private index: InvertedIndex;
  private k1: number;
  private b: number;

  constructor(index: InvertedIndex, config?: BM25Config) {
    this.index = index;
    this.k1 = config?.k1 ?? 1.5;
    this.b = config?.b ?? 0.75;
  }

  search(query: string, topK: number = 20): SparseRetrievalResult[] {
    const analyzer = this.index.getAnalyzer();
    const queryTokens = analyzer.extractTerms(query);
    if (queryTokens.length === 0) return [];

    const stats = this.index.getStats();
    const N = stats.totalDocuments;
    if (N === 0) return [];

    const avgdl = stats.avgDocLength;
    const scores = new Map<string, { score: number; matchedTerms: Set<string> }>();

    for (const term of queryTokens) {
      const postings = this.index.getPostings(term);
      if (!postings) continue;

      const n = this.index.getDocFrequency(term);
      // Robertson-Spärck Jones IDF formula (floored at 0)
      const idf = Math.max(0, Math.log((N - n + 0.5) / (n + 0.5) + 1));

      for (const posting of postings) {
        const docLen = this.index.getDocLength(posting.chunkId);
        const tf = posting.termFrequency;

        // BM25 term score computation
        const num = tf * (this.k1 + 1);
        const denom = tf + this.k1 * (1 - this.b + this.b * (docLen / (avgdl || 1)));
        const termScore = idf * (num / denom);

        if (!scores.has(posting.chunkId)) {
          scores.set(posting.chunkId, { score: 0, matchedTerms: new Set() });
        }

        const docScoreObj = scores.get(posting.chunkId)!;
        docScoreObj.score += termScore;
        docScoreObj.matchedTerms.add(term);
      }
    }

    const results: SparseRetrievalResult[] = [];
    for (const [chunkId, { score, matchedTerms }] of scores.entries()) {
      const chunk = this.index.getChunk(chunkId);
      if (chunk) {
        results.push({
          docId: chunk.metadata.documentId || chunkId,
          chunk,
          score,
          matchedTerms: Array.from(matchedTerms),
          rank: 0
        });
      }
    }

    // Sort descending by BM25 raw score
    results.sort((a, b) => b.score - a.score);

    const topResults = results.slice(0, topK);
    topResults.forEach((res, i) => {
      res.rank = i + 1;
    });

    return topResults;
  }
}
