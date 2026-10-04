import { ChildChunk, ChildSearchHit } from '../types';
import { embeddingService } from './embedding.service';

/**
 * ChildVectorStoreService embeds and indexes the small CHILD chunks.
 *
 * This is the layer the vector search actually queries: matches here are
 * precise, and every hit knows its parent via `child.parentId`.
 */
export class ChildVectorStoreService {
  private children: ChildChunk[] = [];
  private isInitialized: boolean = false;

  /**
   * Embeds a batch of child chunks and appends them to the vector index.
   * Returns the number of children indexed.
   */
  async ingestChildren(children: ChildChunk[]): Promise<number> {
    if (children.length === 0) return 0;

    const textsToEmbed = children.map((c) => `${c.content} ${c.metadata.title || ''}`.trim());
    const embeddings = await embeddingService.getBatchEmbeddings(textsToEmbed);

    for (let i = 0; i < children.length; i++) {
      children[i].embedding = embeddings[i];
    }

    this.children = [...this.children, ...children];
    this.isInitialized = true;
    return children.length;
  }

  /**
   * Returns all indexed child chunks.
   */
  getChildren(): ChildChunk[] {
    return this.children;
  }

  /**
   * Performs dense vector similarity search over child embeddings.
   */
  searchByVector(vector: number[], topK: number = 10): ChildSearchHit[] {
    if (this.children.length === 0 || !vector || vector.length === 0) return [];

    const scored: Array<{ child: ChildChunk; score: number }> = [];

    for (const child of this.children) {
      if (!child.embedding) continue;
      const similarity = embeddingService.cosineSimilarity(vector, child.embedding);
      scored.push({ child, score: similarity });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).map((entry, idx) => ({
      child: entry.child,
      score: entry.score,
      searchMethod: 'child_dense' as const,
      rank: idx + 1,
    }));
  }

  /**
   * Convenience helper that embeds a text query then searches the child index.
   */
  async searchByText(text: string, topK: number = 10): Promise<ChildSearchHit[]> {
    const vector = await embeddingService.getEmbedding(text);
    return this.searchByVector(vector, topK);
  }

  /**
   * Clears the child vector index.
   */
  clear(): void {
    this.children = [];
    this.isInitialized = false;
  }

  /**
   * Indicates whether the child index holds any embedded children.
   */
  isReady(): boolean {
    return this.isInitialized && this.children.length > 0;
  }
}

export const vectorStoreService = new ChildVectorStoreService();
