import { TextSplitter } from './base';
import { Document, Chunk } from '../schemas';

export interface TokenSplitterOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

export class TokenTextSplitter implements TextSplitter {
  private maxTokens: number;
  private overlapTokens: number;

  constructor(options?: TokenSplitterOptions) {
    this.maxTokens = options?.maxTokens ?? 300;
    this.overlapTokens = options?.overlapTokens ?? 30;

    if (this.overlapTokens >= this.maxTokens) {
      throw new Error(`overlapTokens (${this.overlapTokens}) must be strictly smaller than maxTokens (${this.maxTokens})`);
    }
  }

  splitDocument(document: Document): Chunk[] {
    const text = document.content;
    if (!text || text.trim().length === 0) return [];

    const words = text.split(/(\s+)/);
    const chunks: Chunk[] = [];
    let currentWords: string[] = [];
    let currentTokenEstimate = 0;
    let chunkIdx = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      // Roughly 1 word token ~ 1.3 tokens
      const wordTokenEst = Math.ceil(word.trim().length / 4) || 1;

      if (currentTokenEstimate + wordTokenEst > this.maxTokens && currentWords.length > 0) {
        const chunkContent = currentWords.join('').trim();
        if (chunkContent.length > 0) {
          chunks.push({
            id: `${document.id}_token_chunk_${chunkIdx}`,
            content: chunkContent,
            metadata: {
              ...document.metadata,
              documentId: document.id,
              chunkIndex: chunkIdx++,
              tokenCount: currentTokenEstimate,
            },
          });
        }

        // Calculate overlap words
        let overlapEst = 0;
        const overlapWords: string[] = [];
        for (let j = currentWords.length - 1; j >= 0; j--) {
          const w = currentWords[j];
          const est = Math.ceil(w.trim().length / 4) || 1;
          if (overlapEst + est <= this.overlapTokens) {
            overlapEst += est;
            overlapWords.unshift(w);
          } else {
            break;
          }
        }
        currentWords = overlapWords;
        currentTokenEstimate = overlapEst;
      }

      currentWords.push(word);
      currentTokenEstimate += wordTokenEst;
    }

    if (currentWords.length > 0) {
      const lastChunkContent = currentWords.join('').trim();
      if (lastChunkContent.length > 0) {
        chunks.push({
          id: `${document.id}_token_chunk_${chunkIdx}`,
          content: lastChunkContent,
          metadata: {
            ...document.metadata,
            documentId: document.id,
            chunkIndex: chunkIdx,
            tokenCount: currentTokenEstimate,
          },
        });
      }
    }

    const totalChunks = chunks.length;
    chunks.forEach((c) => (c.metadata.totalChunks = totalChunks));
    return chunks;
  }

  splitDocuments(documents: Document[]): Chunk[] {
    return documents.flatMap((doc) => this.splitDocument(doc));
  }
}
