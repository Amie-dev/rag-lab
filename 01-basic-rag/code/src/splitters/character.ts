import { TextSplitter } from './base';
import { Document, Chunk } from '../schemas';

export interface RecursiveCharacterSplitterOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

export class RecursiveCharacterTextSplitter implements TextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(options?: RecursiveCharacterSplitterOptions) {
    this.chunkSize = options?.chunkSize ?? 500;
    this.chunkOverlap = options?.chunkOverlap ?? 50;
    this.separators = options?.separators ?? ['\n\n', '\n', '. ', ' ', ''];

    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error(`chunkOverlap (${this.chunkOverlap}) must be strictly smaller than chunkSize (${this.chunkSize})`);
    }
  }

  splitDocument(document: Document): Chunk[] {
    const text = document.content;
    if (!text || text.trim().length === 0) {
      return [];
    }

    const rawChunks = this.splitText(text, this.separators);
    const chunks: Chunk[] = [];
    const totalChunks = rawChunks.length;

    rawChunks.forEach((item, index) => {
      chunks.push({
        id: `${document.id}_chunk_${index}`,
        content: item.text,
        metadata: {
          ...document.metadata,
          documentId: document.id,
          chunkIndex: index,
          totalChunks,
          startCharIndex: item.startIndex,
          endCharIndex: item.endIndex,
        },
      });
    });

    return chunks;
  }

  splitDocuments(documents: Document[]): Chunk[] {
    return documents.flatMap((doc) => this.splitDocument(doc));
  }

  private splitText(text: string, separators: string[]): Array<{ text: string; startIndex: number; endIndex: number }> {
    const result: Array<{ text: string; startIndex: number; endIndex: number }> = [];
    let start = 0;

    while (start < text.length) {
      let end = start + this.chunkSize;
      if (end >= text.length) {
        end = text.length;
      } else {
        // Try to break at a clean separator
        let breakIndex = -1;
        for (const sep of separators) {
          if (sep === '') continue;
          const searchStart = Math.max(start, end - Math.floor(this.chunkSize * 0.3));
          const idx = text.lastIndexOf(sep, end);
          if (idx > searchStart) {
            breakIndex = idx + sep.length;
            break;
          }
        }
        if (breakIndex !== -1) {
          end = breakIndex;
        }
      }

      const chunkText = text.substring(start, end).trim();
      if (chunkText.length > 0) {
        result.push({
          text: chunkText,
          startIndex: start,
          endIndex: end,
        });
      }

      if (end >= text.length) {
        break;
      }

      // Advance start by chunkSize minus overlap
      start = end - this.chunkOverlap;
      if (start <= result[result.length - 1]?.startIndex) {
        start = result[result.length - 1].startIndex + 1;
      }
    }

    return result;
  }
}
