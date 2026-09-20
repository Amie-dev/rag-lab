# 🔤 Chapter 3 — Sparse Lexical BM25 Search Subsystem

Welcome to Chapter 3 of the **Hybrid RAG Implementation Guide**. In this chapter, we explore the **Sparse Lexical Search Subsystem**, responsible for exact term matching and technical identifier preservation.

All code snippets in this chapter are taken directly from [`04-hybrid-rag/code`](../code).

---

## 1. Technical Text Analyzer (`src/sparse/analyzer.ts`)

File: [`04-hybrid-rag/code/src/sparse/analyzer.ts`](../code/src/sparse/analyzer.ts)

```typescript
/**
 * Text Analyzer / Tokenizer specialized for technical document lexical retrieval
 */

export interface Token {
  term: string;
  rawTerm: string;
  position: number;
}

const DEFAULT_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'or', 'this', 'but', 'they', 'have', 'had', 'what', 'when',
  'where', 'who', 'which', 'why', 'how'
]);

export class TechnicalTextAnalyzer {
  private stopWords: Set<string>;

  constructor(customStopWords?: string[]) {
    this.stopWords = customStopWords ? new Set(customStopWords) : DEFAULT_STOP_WORDS;
  }

  tokenize(text: string): Token[] {
    if (!text) return [];

    // Regex matching technical terms (e.g. ERR_CONNECTION_TIMED_OUT, 0x80004005, TX-9021-B, createPaymentIntent)
    // or alphanumeric sequences
    const pattern = /0x[a-fA-F0-9]+|[a-zA-Z0-9]+(?:[-_:][a-zA-Z0-9]+)*/g;
    const tokens: Token[] = [];
    let match: RegExpExecArray | null;
    let position = 0;

    while ((match = pattern.exec(text)) !== null) {
      const rawTerm = match[0];
      const term = rawTerm.toLowerCase();

      // Keep token if it's not a stop word OR if it contains numbers/underscores/dashes (likely technical code)
      const isTechIdentifier = /[0-9_-]/.test(rawTerm);
      if (isTechIdentifier || !this.stopWords.has(term)) {
        tokens.push({
          term,
          rawTerm,
          position: position++
        });
      }
    }

    return tokens;
  }

  extractTerms(text: string): string[] {
    return this.tokenize(text).map((t) => t.term);
  }
}
```

### Methods Explanation (`TechnicalTextAnalyzer`)
- `tokenize(text)`: Scans input text using regex `/0x[a-fA-F0-9]+|[a-zA-Z0-9]+(?:[-_:][a-zA-Z0-9]+)*/g`. This pattern preserves hexadecimal strings (`0x80004005`), hyphenated hardware SKUs (`TX-9021-B`), and uppercase error constants (`ERR_CONNECTION_TIMED_OUT`). It preserves technical identifiers containing numbers/underscores even if they match common stop words.
- `extractTerms(text)`: Helper extracting lowercased term strings from token objects.

---

## 2. Inverted Index Data Structure (`src/sparse/inverted-index.ts`)

File: [`04-hybrid-rag/code/src/sparse/inverted-index.ts`](../code/src/sparse/inverted-index.ts)

```typescript
import { Chunk } from '../schemas';
import { TechnicalTextAnalyzer } from './analyzer';

export interface Posting {
  chunkId: string;
  termFrequency: number;
  positions: number[];
}

export interface InvertedIndexStats {
  totalDocuments: number;
  vocabularySize: number;
  avgDocLength: number;
  docLengths: Map<string, number>;
}

export class InvertedIndex {
  private analyzer: TechnicalTextAnalyzer;
  private postings: Map<string, Posting[]> = new Map(); // term -> Posting[]
  private docFrequency: Map<string, number> = new Map(); // term -> doc count
  private chunks: Map<string, Chunk> = new Map(); // chunkId -> Chunk
  private docLengths: Map<string, number> = new Map(); // chunkId -> doc length (token count)
  private totalTokensCount: number = 0;

  constructor(analyzer?: TechnicalTextAnalyzer) {
    this.analyzer = analyzer ?? new TechnicalTextAnalyzer();
  }

  addChunk(chunk: Chunk): void {
    const tokens = this.analyzer.tokenize(chunk.content);
    this.chunks.set(chunk.id, chunk);

    const docLen = tokens.length;
    this.docLengths.set(chunk.id, docLen);
    this.totalTokensCount += docLen;

    const termMap = new Map<string, number[]>();
    for (const token of tokens) {
      if (!termMap.has(token.term)) {
        termMap.set(token.term, []);
      }
      termMap.get(token.term)!.push(token.position);
    }

    for (const [term, positions] of termMap.entries()) {
      if (!this.postings.has(term)) {
        this.postings.set(term, []);
        this.docFrequency.set(term, 0);
      }

      this.postings.get(term)!.push({
        chunkId: chunk.id,
        termFrequency: positions.length,
        positions
      });

      this.docFrequency.set(term, (this.docFrequency.get(term) || 0) + 1);
    }
  }

  addChunks(chunks: Chunk[]): void {
    for (const chunk of chunks) {
      this.addChunk(chunk);
    }
  }

  getPostings(term: string): Posting[] | undefined {
    return this.postings.get(term);
  }

  getDocFrequency(term: string): number {
    return this.docFrequency.get(term) || 0;
  }

  getChunk(chunkId: string): Chunk | undefined {
    return this.chunks.get(chunkId);
  }

  getDocLength(chunkId: string): number {
    return this.docLengths.get(chunkId) || 0;
  }

  getStats(): InvertedIndexStats {
    const totalDocs = this.chunks.size;
    const avgLen = totalDocs > 0 ? this.totalTokensCount / totalDocs : 0;

    return {
      totalDocuments: totalDocs,
      vocabularySize: this.postings.size,
      avgDocLength: avgLen,
      docLengths: this.docLengths
    };
  }

  getAnalyzer(): TechnicalTextAnalyzer {
    return this.analyzer;
  }

  clear(): void {
    this.postings.clear();
    this.docFrequency.clear();
    this.chunks.clear();
    this.docLengths.clear();
    this.totalTokensCount = 0;
  }

  size(): number {
    return this.chunks.size;
  }
}
```

### Methods Explanation (`InvertedIndex`)
- `addChunk(chunk)`: Tokenizes chunk content, updates total indexed token count, constructs term position lists, and creates postings pointing to the chunk ID with term frequencies.
- `getStats()`: Computes global index stats including total document chunk count $N$, vocabulary size, and average document token length $\text{avgdl}$.

---

## 3. Okapi BM25 Scoring Engine (`src/sparse/bm25.ts`)

File: [`04-hybrid-rag/code/src/sparse/bm25.ts`](../code/src/sparse/bm25.ts)

```typescript
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
```

### Methods Explanation (`BM25Engine`)
- `search(query, topK)`: Tokenizes search query into unique terms, iterates over posting lists, calculates IDF using $\ln(1 + \frac{N - n + 0.5}{n + 0.5})$, applies term frequency saturation ($k_1=1.5$) and length penalty ($b=0.75$), sums term scores per chunk, sorts candidates descending, and returns top $K$ results with 1-indexed ranks.

In [Chapter 4](./04-rank-and-score-fusion-engine.md), we will build the **Rank & Score Fusion Subsystem**.
