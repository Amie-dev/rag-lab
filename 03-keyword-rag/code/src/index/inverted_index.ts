import * as fs from 'fs';
import * as path from 'path';
import {
  Chunk,
  Posting,
  PositionedToken,
  InvertedIndexStats,
  SerializedInvertedIndex,
  SerializedPosting,
} from '../schemas';

export class InvertedIndex {
  // Map of term -> Map of docId -> Posting
  private index: Map<string, Map<string, Posting>> = new Map();

  // Document Frequency per term: term -> number of docs containing term
  private docFrequency: Map<string, number> = new Map();

  // Total occurrences of term across all documents: term -> total frequency
  private collectionTermFrequency: Map<string, number> = new Map();

  // Document length (number of tokens) per docId
  private docLengths: Map<string, number> = new Map();

  // Chunks storage keyed by chunkId
  private chunks: Map<string, Chunk> = new Map();

  // Total tokens across all indexed documents
  private totalTokens = 0;

  /**
   * Indexes a Chunk with its analyzed tokens.
   */
  public addChunk(chunk: Chunk, tokens: PositionedToken[]): void {
    const docId = chunk.id;

    // Remove existing entry if re-indexing
    if (this.chunks.has(docId)) {
      this.removeChunk(docId);
    }

    this.chunks.set(docId, chunk);
    this.docLengths.set(docId, tokens.length);
    this.totalTokens += tokens.length;

    // Group tokens by term to build postings
    const termMap = new Map<
      string,
      { tf: number; positions: number[]; offsets: Array<{ start: number; end: number }> }
    >();

    for (const token of tokens) {
      const term = token.term;
      let entry = termMap.get(term);
      if (!entry) {
        entry = { tf: 0, positions: [], offsets: [] };
        termMap.set(term, entry);
      }
      entry.tf += 1;
      entry.positions.push(token.position);
      entry.offsets.push({ start: token.startOffset, end: token.endOffset });
    }

    // Populate inverted index structures
    for (const [term, data] of termMap.entries()) {
      let postingsMap = this.index.get(term);
      if (!postingsMap) {
        postingsMap = new Map();
        this.index.set(term, postingsMap);
      }

      postingsMap.set(docId, {
        docId,
        termFrequency: data.tf,
        positions: data.positions,
        termOffsets: data.offsets,
      });

      // Update Term Statistics
      this.docFrequency.set(term, (this.docFrequency.get(term) || 0) + 1);
      this.collectionTermFrequency.set(
        term,
        (this.collectionTermFrequency.get(term) || 0) + data.tf
      );
    }
  }

  /**
   * Removes a Chunk from the index.
   */
  public removeChunk(chunkId: string): boolean {
    if (!this.chunks.has(chunkId)) return false;

    const docLength = this.docLengths.get(chunkId) || 0;
    this.totalTokens -= docLength;
    this.docLengths.delete(chunkId);
    this.chunks.delete(chunkId);

    for (const [term, postingsMap] of this.index.entries()) {
      const posting = postingsMap.get(chunkId);
      if (posting) {
        postingsMap.delete(chunkId);

        // Update statistics
        const currentDf = this.docFrequency.get(term) || 1;
        if (currentDf <= 1) {
          this.docFrequency.delete(term);
        } else {
          this.docFrequency.set(term, currentDf - 1);
        }

        const currentCtf = this.collectionTermFrequency.get(term) || posting.termFrequency;
        const newCtf = currentCtf - posting.termFrequency;
        if (newCtf <= 0) {
          this.collectionTermFrequency.delete(term);
        } else {
          this.collectionTermFrequency.set(term, newCtf);
        }

        if (postingsMap.size === 0) {
          this.index.delete(term);
        }
      }
    }

    return true;
  }

  /**
   * Gets postings list for a given term.
   */
  public getPostings(term: string): Posting[] {
    const postingsMap = this.index.get(term.toLowerCase());
    if (!postingsMap) return [];
    return Array.from(postingsMap.values());
  }

  /**
   * Gets specific posting for a term and docId.
   */
  public getPosting(term: string, docId: string): Posting | undefined {
    return this.index.get(term.toLowerCase())?.get(docId);
  }

  /**
   * Document frequency (number of documents containing term).
   */
  public getDocumentFrequency(term: string): number {
    return this.docFrequency.get(term.toLowerCase()) || 0;
  }

  /**
   * Collection term frequency (total occurrences of term in collection).
   */
  public getCollectionTermFrequency(term: string): number {
    return this.collectionTermFrequency.get(term.toLowerCase()) || 0;
  }

  /**
   * Document length in tokens.
   */
  public getDocLength(docId: string): number {
    return this.docLengths.get(docId) || 0;
  }

  /**
   * Average document length across the indexed collection.
   */
  public getAvgDocLength(): number {
    const totalDocs = this.chunks.size;
    if (totalDocs === 0) return 0;
    return this.totalTokens / totalDocs;
  }

  /**
   * Total number of indexed documents/chunks.
   */
  public getTotalDocuments(): number {
    return this.chunks.size;
  }

  /**
   * Total number of unique terms in the vocabulary.
   */
  public getVocabularySize(): number {
    return this.index.size;
  }

  /**
   * Gets stored Chunk by ID.
   */
  public getChunk(chunkId: string): Chunk | undefined {
    return this.chunks.get(chunkId);
  }

  /**
   * Returns all stored Chunks.
   */
  public getAllChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Returns high-level index statistics.
   */
  public getStats(): InvertedIndexStats {
    const docLengthsObj: Record<string, number> = {};
    for (const [id, len] of this.docLengths.entries()) {
      docLengthsObj[id] = len;
    }

    return {
      totalDocuments: this.getTotalDocuments(),
      totalTerms: this.totalTokens,
      vocabularySize: this.getVocabularySize(),
      avgDocLength: this.getAvgDocLength(),
      docLengths: docLengthsObj,
    };
  }

  /**
   * Clears the inverted index.
   */
  public clear(): void {
    this.index.clear();
    this.docFrequency.clear();
    this.collectionTermFrequency.clear();
    this.docLengths.clear();
    this.chunks.clear();
    this.totalTokens = 0;
  }

  /**
   * Serializes the index into a plain JSON object.
   */
  public serialize(): SerializedInvertedIndex {
    const postingsObj: Record<string, SerializedPosting[]> = {};
    for (const [term, postingsMap] of this.index.entries()) {
      postingsObj[term] = Array.from(postingsMap.values()).map((p) => ({
        docId: p.docId,
        termFrequency: p.termFrequency,
        positions: p.positions,
        termOffsets: p.termOffsets,
      }));
    }

    const docFreqObj: Record<string, number> = {};
    for (const [term, df] of this.docFrequency.entries()) {
      docFreqObj[term] = df;
    }

    const ctfObj: Record<string, number> = {};
    for (const [term, ctf] of this.collectionTermFrequency.entries()) {
      ctfObj[term] = ctf;
    }

    const chunksObj: Record<string, Chunk> = {};
    for (const [id, chunk] of this.chunks.entries()) {
      chunksObj[id] = chunk;
    }

    return {
      version: '1.0.0',
      stats: this.getStats(),
      postings: postingsObj,
      docFrequency: docFreqObj,
      collectionTermFrequency: ctfObj,
      chunks: chunksObj,
    };
  }

  /**
   * Restores index from serialized JSON data.
   */
  public deserialize(data: SerializedInvertedIndex): void {
    this.clear();

    for (const [id, chunk] of Object.entries(data.chunks)) {
      this.chunks.set(id, chunk);
    }

    for (const [id, len] of Object.entries(data.stats.docLengths)) {
      this.docLengths.set(id, len);
      this.totalTokens += len;
    }

    for (const [term, df] of Object.entries(data.docFrequency)) {
      this.docFrequency.set(term, df);
    }

    for (const [term, ctf] of Object.entries(data.collectionTermFrequency)) {
      this.collectionTermFrequency.set(term, ctf);
    }

    for (const [term, postingsList] of Object.entries(data.postings)) {
      const postingsMap = new Map<string, Posting>();
      for (const p of postingsList) {
        postingsMap.set(p.docId, {
          docId: p.docId,
          termFrequency: p.termFrequency,
          positions: p.positions,
          termOffsets: p.termOffsets,
        });
      }
      this.index.set(term, postingsMap);
    }
  }

  /**
   * Persists index to a file on disk.
   */
  public async saveToFile(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const serialized = this.serialize();
    await fs.promises.writeFile(filePath, JSON.stringify(serialized, null, 2), 'utf8');
  }

  /**
   * Loads index from a file on disk.
   */
  public async loadFromFile(filePath: string): Promise<void> {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const data = JSON.parse(content) as SerializedInvertedIndex;
    this.deserialize(data);
  }
}
