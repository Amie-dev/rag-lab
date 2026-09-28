import { DocumentChunk, IngestDocumentInput, ScoredChunk } from '../types';
import { embeddingService } from './embedding.service';
import { bm25Service } from './bm25.service';
import crypto from 'crypto';

export class VectorStoreService {
  private chunks: DocumentChunk[] = [];

  /**
   * Returns current count of indexed document chunks.
   */
  getChunkCount(): number {
    return this.chunks.length;
  }

  /**
   * Returns all stored chunks.
   */
  getAllChunks(): DocumentChunk[] {
    return [...this.chunks];
  }

  /**
   * Clears stored memory repository.
   */
  clear(): void {
    this.chunks = [];
  }

  /**
   * Ingests a new document chunk into the vector database.
   * Automatically computes vector embeddings.
   */
  async ingestDocument(input: IngestDocumentInput): Promise<DocumentChunk> {
    const id = input.id || `chunk_${crypto.randomBytes(6).toString('hex')}`;
    const embedding = await embeddingService.getEmbedding(input.content);

    const chunk: DocumentChunk = {
      id,
      content: input.content,
      embedding,
      metadata: input.metadata || {},
    };

    // Remove existing if duplicate ID
    this.chunks = this.chunks.filter((c) => c.id !== id);
    this.chunks.push(chunk);

    return chunk;
  }

  /**
   * Bulk ingests document chunks.
   */
  async bulkIngestDocuments(inputs: IngestDocumentInput[]): Promise<DocumentChunk[]> {
    const results: DocumentChunk[] = [];
    for (const input of inputs) {
      const ingested = await this.ingestDocument(input);
      results.push(ingested);
    }
    return results;
  }

  /**
   * Performs Dense Vector Search using Cosine Similarity.
   */
  async vectorSearch(query: string, topK: number = 5): Promise<ScoredChunk[]> {
    if (this.chunks.length === 0) return [];

    const queryEmbedding = await embeddingService.getEmbedding(query);
    const scored: ScoredChunk[] = [];

    for (const chunk of this.chunks) {
      if (!chunk.embedding) continue;
      const score = embeddingService.cosineSimilarity(queryEmbedding, chunk.embedding);
      scored.push({
        chunk,
        score,
        retrievalType: 'vector',
      });
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Performs Sparse BM25 Keyword Search.
   */
  bm25Search(query: string, topK: number = 5): ScoredChunk[] {
    if (this.chunks.length === 0) return [];

    const scored = bm25Service.scoreDocuments(query, this.chunks);
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Performs Hybrid Search combining Dense Vector Search and Sparse BM25 Search with RRF (Reciprocal Rank Fusion).
   */
  async hybridSearch(query: string, topK: number = 5): Promise<ScoredChunk[]> {
    if (this.chunks.length === 0) return [];

    const vectorResults = await this.vectorSearch(query, topK * 2);
    const bm25Results = this.bm25Search(query, topK * 2);

    const rrfMap = new Map<string, { chunk: DocumentChunk; score: number }>();
    const k = 60; // Standard RRF constant

    // Rank vector results
    vectorResults.forEach((res, rank) => {
      const rrfScore = 1 / (k + (rank + 1));
      const existing = rrfMap.get(res.chunk.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        rrfMap.set(res.chunk.id, { chunk: res.chunk, score: rrfScore });
      }
    });

    // Rank BM25 results
    bm25Results.forEach((res, rank) => {
      const rrfScore = 1 / (k + (rank + 1));
      const existing = rrfMap.get(res.chunk.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        rrfMap.set(res.chunk.id, { chunk: res.chunk, score: rrfScore });
      }
    });

    const combined = Array.from(rrfMap.values()).map((item) => ({
      chunk: item.chunk,
      score: item.score,
      retrievalType: 'hybrid' as const,
    }));

    return combined.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Standard search entry point supporting retrieval modes.
   */
  async search(query: string, topK: number = 5, mode: 'vector' | 'bm25' | 'hybrid' = 'hybrid'): Promise<ScoredChunk[]> {
    switch (mode) {
      case 'vector':
        return this.vectorSearch(query, topK);
      case 'bm25':
        return this.bm25Search(query, topK);
      case 'hybrid':
      default:
        return this.hybridSearch(query, topK);
    }
  }
}

export const vectorStoreService = new VectorStoreService();
