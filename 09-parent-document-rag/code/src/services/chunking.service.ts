import { config } from '../config/environment';
import { ChildChunk, ChunkingConfig, Document, ParentChunk } from '../types';

export interface ParentChildChunkResult {
  parents: ParentChunk[];
  children: ChildChunk[];
}

/**
 * ChunkingService builds the two-level parent/child hierarchy that powers
 * Parent-Document RAG:
 *
 *   Raw Document  →  Parent Chunks (large, coherent)  →  Child Chunks (small, precise)
 *
 * Children are the retrieval units (embedded & indexed). Parents are the
 * generation units (complete context), referenced by each child via `parentId`.
 */
export class ChunkingService {
  private readonly CHARS_PER_TOKEN = 4;

  /**
   * Returns the default chunking configuration derived from environment config.
   */
  getDefaultConfig(): ChunkingConfig {
    return {
      parentChunkSize: config.defaultParentChunkSize,
      parentChunkOverlap: config.defaultParentChunkOverlap,
      childChunkSize: config.defaultChildChunkSize,
      childChunkOverlap: config.defaultChildChunkOverlap,
    };
  }

  /**
   * Approximate token count for a piece of text (~4 characters per token).
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Constructs parent and child chunks for a single document, wiring the
   * child→parent and parent→children relationships.
   */
  createParentChildChunks(
    doc: Document,
    overrides: Partial<ChunkingConfig> = {}
  ): ParentChildChunkResult {
    const cfg: ChunkingConfig = { ...this.getDefaultConfig(), ...overrides };

    // Guard against misconfiguration (overlap must be smaller than size).
    const parentOverlap = Math.min(cfg.parentChunkOverlap, Math.max(0, cfg.parentChunkSize - 1));
    const childOverlap = Math.min(cfg.childChunkOverlap, Math.max(0, cfg.childChunkSize - 1));

    const parentTexts = this.chunkText(doc.content, cfg.parentChunkSize, parentOverlap);
    const metadata = doc.metadata || {};

    const parents: ParentChunk[] = [];
    const children: ChildChunk[] = [];

    parentTexts.forEach((parentText, pIdx) => {
      const parentId = `${doc.id}::parent_${pIdx + 1}`;
      const childTexts = this.chunkText(parentText, cfg.childChunkSize, childOverlap);

      const childrenOfParent: ChildChunk[] = childTexts.map((childText, cIdx) => ({
        id: `${parentId}::child_${cIdx + 1}`,
        parentId,
        documentId: doc.id,
        content: childText,
        chunkIndex: cIdx,
        totalChunks: childTexts.length,
        tokenEstimate: this.estimateTokens(childText),
        metadata: {
          ...metadata,
          section: metadata.section || metadata.title,
          parentIndex: pIdx,
          childIndex: cIdx,
        },
      }));

      parents.push({
        id: parentId,
        documentId: doc.id,
        content: parentText,
        parentIndex: pIdx,
        totalParents: parentTexts.length,
        childCount: childrenOfParent.length,
        childIds: childrenOfParent.map((c) => c.id),
        tokenEstimate: this.estimateTokens(parentText),
        metadata: {
          ...metadata,
          section: metadata.section || metadata.title,
          parentIndex: pIdx,
          childCount: childrenOfParent.length,
        },
      });

      children.push(...childrenOfParent);
    });

    return { parents, children };
  }

  /**
   * Boundary-aware fixed-window splitter.
   *
   * Prefers natural sentence boundaries, then word boundaries, and only falls
   * back to a hard character cut when a single unit exceeds the window. A
   * configurable overlap carries trailing context into the next chunk to avoid
   * severing meaning across boundaries.
   */
  chunkText(text: string, chunkSize: number, overlap: number): string[] {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (!cleanText) return [];
    if (cleanText.length <= chunkSize) return [cleanText];

    const chunks: string[] = [];
    let start = 0;

    while (start < cleanText.length) {
      let end = Math.min(start + chunkSize, cleanText.length);

      if (end < cleanText.length) {
        // 1. Prefer to break after a sentence terminator.
        const lastPeriod = cleanText.lastIndexOf('. ', end);
        if (lastPeriod > start + chunkSize * 0.5) {
          end = lastPeriod + 1;
        } else {
          // 2. Otherwise break on the nearest whitespace boundary.
          const lastSpace = cleanText.lastIndexOf(' ', end);
          if (lastSpace > start) {
            end = lastSpace;
          }
        }
      }

      const piece = cleanText.slice(start, end).trim();
      if (piece) chunks.push(piece);
      if (end >= cleanText.length) break;

      // Advance with overlap, guaranteeing forward progress.
      start = Math.max(end - overlap, start + 1);
    }

    return chunks;
  }
}

export const chunkingService = new ChunkingService();
