import { DocumentChunk, RetrievalMode } from '../types';
import { bm25Service } from '../services/bm25.service';

export interface SearchCandidate {
  chunk: DocumentChunk;
  stage1Score: number;
  stage1Rank: number;
  retrievalMethod: RetrievalMode;
}

export class InMemoryVectorStore {
  private chunks: Map<string, DocumentChunk> = new Map();

  /**
   * Adds or updates a document chunk in the store.
   */
  public upsertChunk(chunk: DocumentChunk): void {
    this.chunks.set(chunk.id, chunk);
  }

  /**
   * Batch upserts document chunks.
   */
  public upsertChunks(chunks: DocumentChunk[]): void {
    for (const chunk of chunks) {
      this.upsertChunk(chunk);
    }
  }

  /**
   * Retrieves a document chunk by ID.
   */
  public getChunk(id: string): DocumentChunk | undefined {
    return this.chunks.get(id);
  }

  /**
   * Returns all chunks stored in the vector DB.
   */
  public getAllChunks(): DocumentChunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Clears the vector store.
   */
  public clear(): void {
    this.chunks.clear();
  }

  /**
   * Total number of documents.
   */
  public count(): number {
    return this.chunks.size;
  }

  /**
   * Calculates cosine similarity between two unit vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Stage 1: Dense Vector Similarity Search
   */
  public searchVector(queryEmbedding: number[], topN: number): SearchCandidate[] {
    const all = this.getAllChunks();
    const scored = all.map((chunk) => {
      const score = chunk.embedding ? this.cosineSimilarity(queryEmbedding, chunk.embedding) : 0;
      return { chunk, score };
    });

    // Sort descending by vector similarity
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topN).map((item, idx) => ({
      chunk: item.chunk,
      stage1Score: Math.round(item.score * 1000) / 1000,
      stage1Rank: idx + 1,
      retrievalMethod: 'dense',
    }));
  }

  /**
   * Stage 1: Sparse BM25 Keyword Search
   */
  public searchBM25(queryText: string, topN: number): SearchCandidate[] {
    const all = this.getAllChunks();
    const bm25Scores = bm25Service.scoreDocuments(queryText, all);

    const scored = all.map((chunk) => ({
      chunk,
      score: bm25Scores.get(chunk.id) || 0,
    }));

    // Sort descending by BM25 score
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topN).map((item, idx) => ({
      chunk: item.chunk,
      stage1Score: Math.round(item.score * 1000) / 1000,
      stage1Rank: idx + 1,
      retrievalMethod: 'sparse',
    }));
  }

  /**
   * Stage 1: Hybrid Search (Reciprocal Rank Fusion RRF)
   * Combines Dense Vector Search and Sparse BM25 Search.
   */
  public searchHybrid(
    queryText: string,
    queryEmbedding: number[],
    topN: number,
    alpha = 0.5,
    rrfK = 60
  ): SearchCandidate[] {
    const denseCandidates = this.searchVector(queryEmbedding, topN * 2);
    const sparseCandidates = this.searchBM25(queryText, topN * 2);

    const rrfMap = new Map<string, { chunk: DocumentChunk; rrfScore: number; denseRank?: number; sparseRank?: number }>();

    // Calculate RRF for Dense
    denseCandidates.forEach((cand) => {
      const existing = rrfMap.get(cand.chunk.id) || { chunk: cand.chunk, rrfScore: 0 };
      const rrfContribution = (1 - alpha) * (1 / (rrfK + cand.stage1Rank));
      existing.rrfScore += rrfContribution;
      existing.denseRank = cand.stage1Rank;
      rrfMap.set(cand.chunk.id, existing);
    });

    // Calculate RRF for Sparse
    sparseCandidates.forEach((cand) => {
      const existing = rrfMap.get(cand.chunk.id) || { chunk: cand.chunk, rrfScore: 0 };
      const rrfContribution = alpha * (1 / (rrfK + cand.stage1Rank));
      existing.rrfScore += rrfContribution;
      existing.sparseRank = cand.stage1Rank;
      rrfMap.set(cand.chunk.id, existing);
    });

    const merged = Array.from(rrfMap.values());
    merged.sort((a, b) => b.rrfScore - a.rrfScore);

    return merged.slice(0, topN).map((item, idx) => ({
      chunk: item.chunk,
      stage1Score: Math.round(item.rrfScore * 100000) / 100000,
      stage1Rank: idx + 1,
      retrievalMethod: 'hybrid',
    }));
  }

  /**
   * Dynamic retrieval based on mode.
   */
  public search(
    queryText: string,
    queryEmbedding: number[],
    mode: RetrievalMode,
    topN: number,
    alpha = 0.5
  ): SearchCandidate[] {
    switch (mode) {
      case 'dense':
        return this.searchVector(queryEmbedding, topN);
      case 'sparse':
        return this.searchBM25(queryText, topN);
      case 'hybrid':
      default:
        return this.searchHybrid(queryText, queryEmbedding, topN, alpha);
    }
  }
}

export const inMemoryVectorStore = new InMemoryVectorStore();
