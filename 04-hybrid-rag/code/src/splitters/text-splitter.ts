import { Document, Chunk } from '../schemas';

export interface TextSplitterConfig {
  chunkSize?: number;     // Max characters per chunk (default: 500)
  chunkOverlap?: number;  // Overlap characters (default: 50)
  separators?: string[];  // Separators in priority order
}

export class RecursiveTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(config?: TextSplitterConfig) {
    this.chunkSize = config?.chunkSize ?? 500;
    this.chunkOverlap = config?.chunkOverlap ?? 50;
    this.separators = config?.separators ?? ['\n\n', '\n', ' ', ''];
  }

  splitDocument(doc: Document): Chunk[] {
    const rawChunks = this.splitText(doc.content, this.separators);
    const totalChunks = rawChunks.length;

    return rawChunks.map((item, index) => ({
      id: `${doc.id}_chunk_${index}`,
      content: item.text,
      metadata: {
        ...doc.metadata,
        documentId: doc.id,
        chunkIndex: index,
        totalChunks,
        startCharIndex: item.startCharIndex,
        endCharIndex: item.endCharIndex,
        tokenCount: item.text.split(/\s+/).length
      }
    }));
  }

  splitDocuments(docs: Document[]): Chunk[] {
    return docs.flatMap((doc) => this.splitDocument(doc));
  }

  private splitText(text: string, separators: string[]): Array<{ text: string; startCharIndex: number; endCharIndex: number }> {
    const results: Array<{ text: string; startCharIndex: number; endCharIndex: number }> = [];
    if (!text || text.trim().length === 0) return results;

    let currentStart = 0;
    while (currentStart < text.length) {
      let currentEnd = Math.min(currentStart + this.chunkSize, text.length);

      if (currentEnd < text.length) {
        // Find best separator backward
        let separatorFound = false;
        for (const sep of separators) {
          if (!sep) continue;
          const lastIdx = text.lastIndexOf(sep, currentEnd);
          if (lastIdx > currentStart + this.chunkOverlap) {
            currentEnd = lastIdx + sep.length;
            separatorFound = true;
            break;
          }
        }
      }

      const chunkText = text.slice(currentStart, currentEnd).trim();
      if (chunkText.length > 0) {
        results.push({
          text: chunkText,
          startCharIndex: currentStart,
          endCharIndex: currentEnd
        });
      }

      const nextStart = currentEnd - this.chunkOverlap;
      currentStart = nextStart > currentStart ? nextStart : currentEnd;
    }

    return results;
  }
}
