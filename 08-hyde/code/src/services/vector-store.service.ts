import { Document, DocumentChunk, SearchHit } from '../types';
import { embeddingService } from './embedding.service';

export class VectorStoreService {
  private chunks: DocumentChunk[] = [];
  private isInitialized: boolean = false;

  /**
   * Ingests documents, chunks content, computes dense embeddings, and loads into vector index.
   */
  async ingestDocuments(docs: Document[], chunkSize: number = 300, chunkOverlap: number = 50): Promise<number> {
    const newChunks: DocumentChunk[] = [];

    for (const doc of docs) {
      const docChunks = this.chunkText(doc.content, chunkSize, chunkOverlap);
      for (let i = 0; i < docChunks.length; i++) {
        const chunkText = docChunks[i];
        const chunk: DocumentChunk = {
          id: `${doc.id}_chunk_${i + 1}`,
          documentId: doc.id,
          content: chunkText,
          chunkIndex: i,
          totalChunks: docChunks.length,
          metadata: doc.metadata || {},
        };
        newChunks.push(chunk);
      }
    }

    // Compute batch embeddings for all chunks
    const chunkTexts = newChunks.map((c) => c.content + ' ' + (c.metadata.title || ''));
    const embeddings = await embeddingService.getBatchEmbeddings(chunkTexts);

    for (let i = 0; i < newChunks.length; i++) {
      newChunks[i].embedding = embeddings[i];
    }

    this.chunks = [...this.chunks, ...newChunks];
    this.isInitialized = true;

    return newChunks.length;
  }

  /**
   * Retrieves all chunks stored in vector database.
   */
  getChunks(): DocumentChunk[] {
    return this.chunks;
  }

  /**
   * Performs dense vector similarity search using a pre-computed vector embedding.
   */
  searchByVector(vector: number[], topK: number = 5, methodLabel: 'hyde_vector' | 'direct_vector' = 'hyde_vector'): SearchHit[] {
    if (this.chunks.length === 0 || !vector || vector.length === 0) return [];

    const hits: SearchHit[] = [];

    for (const chunk of this.chunks) {
      if (!chunk.embedding) continue;
      const similarity = embeddingService.cosineSimilarity(vector, chunk.embedding);
      hits.push({
        chunk,
        score: similarity,
        searchMethod: methodLabel,
      });
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, topK);
  }

  /**
   * Utility helper to search vector store using text string directly.
   */
  async searchByText(text: string, topK: number = 5, methodLabel: 'hyde_vector' | 'direct_vector' = 'direct_vector'): Promise<SearchHit[]> {
    const vector = await embeddingService.getEmbedding(text);
    return this.searchByVector(vector, topK, methodLabel);
  }

  /**
   * Resets vector store memory.
   */
  clear(): void {
    this.chunks = [];
    this.isInitialized = false;
  }

  /**
   * Checks if store contains documents.
   */
  isReady(): boolean {
    return this.isInitialized && this.chunks.length > 0;
  }

  /**
   * Fixed-size character sliding window chunker.
   */
  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (cleanText.length <= chunkSize) return [cleanText];

    const chunks: string[] = [];
    let start = 0;

    while (start < cleanText.length) {
      let end = start + chunkSize;

      if (end < cleanText.length) {
        // Try to break on sentence or word boundary
        const lastPeriod = cleanText.lastIndexOf('. ', end);
        if (lastPeriod > start + chunkSize / 2) {
          end = lastPeriod + 1;
        } else {
          const lastSpace = cleanText.lastIndexOf(' ', end);
          if (lastSpace > start) {
            end = lastSpace;
          }
        }
      }

      chunks.push(cleanText.slice(start, end).trim());
      start = end - overlap;
      if (start >= cleanText.length || end >= cleanText.length) break;
    }

    return chunks;
  }
}

export const vectorStoreService = new VectorStoreService();
