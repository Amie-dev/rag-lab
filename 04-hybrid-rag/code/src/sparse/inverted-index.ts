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

    // Group token occurrences by term
    const termMap = new Map<string, number[]>();
    for (const token of tokens) {
      if (!termMap.has(token.term)) {
        termMap.set(token.term, []);
      }
      termMap.get(token.term)!.push(token.position);
    }

    // Update postings and document frequencies
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
