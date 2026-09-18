import { Document, Chunk, ChunkMetadata } from '../schemas';

export interface TextSplitterOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

export abstract class TextSplitter {
  protected chunkSize: number;
  protected chunkOverlap: number;

  constructor(options: TextSplitterOptions = {}) {
    this.chunkSize = options.chunkSize ?? 500;
    this.chunkOverlap = options.chunkOverlap ?? 50;

    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error('chunkOverlap must be smaller than chunkSize');
    }
  }

  public abstract splitText(text: string): string[];

  public splitDocuments(documents: Document[]): Chunk[] {
    const chunks: Chunk[] = [];

    for (const doc of documents) {
      const textChunks = this.splitText(doc.content);
      const totalChunks = textChunks.length;

      let currentCharIndex = 0;
      for (let i = 0; i < textChunks.length; i++) {
        const chunkContent = textChunks[i];
        const startCharIndex = doc.content.indexOf(chunkContent, currentCharIndex);
        const endCharIndex =
          startCharIndex !== -1 ? startCharIndex + chunkContent.length : currentCharIndex + chunkContent.length;

        if (startCharIndex !== -1) {
          currentCharIndex = startCharIndex + Math.max(1, chunkContent.length - this.chunkOverlap);
        }

        const metadata: ChunkMetadata = {
          ...doc.metadata,
          documentId: doc.id,
          chunkIndex: i,
          totalChunks,
          startCharIndex: startCharIndex !== -1 ? startCharIndex : undefined,
          endCharIndex: endCharIndex !== -1 ? endCharIndex : undefined,
          tokenCount: chunkContent.split(/\s+/).length,
        };

        chunks.push({
          id: `${doc.id}_chunk_${i}`,
          content: chunkContent,
          metadata,
        });
      }
    }

    return chunks;
  }
}

export class CharacterTextSplitter extends TextSplitter {
  private separator: string;

  constructor(options: TextSplitterOptions & { separator?: string } = {}) {
    super(options);
    this.separator = options.separator ?? '\n\n';
  }

  public splitText(text: string): string[] {
    const splits = text.split(this.separator);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const split of splits) {
      if ((currentChunk + (currentChunk ? this.separator : '') + split).length <= this.chunkSize) {
        currentChunk += (currentChunk ? this.separator : '') + split;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = split;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

export class RecursiveCharacterTextSplitter extends TextSplitter {
  private separators: string[];

  constructor(options: TextSplitterOptions = {}) {
    super(options);
    this.separators = options.separators ?? ['\n\n', '\n', ' ', ''];
  }

  public splitText(text: string): string[] {
    return this.recursiveSplit(text, this.separators);
  }

  private recursiveSplit(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];

    let separator = separators[separators.length - 1];
    let newSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
      const s = separators[i];
      if (s === '' || text.includes(s)) {
        separator = s;
        newSeparators = separators.slice(i + 1);
        break;
      }
    }

    const splits = separator === '' ? Array.from(text) : text.split(separator);
    let currentChunk = '';

    for (const split of splits) {
      const candidate = currentChunk
        ? currentChunk + (separator === '' ? '' : separator) + split
        : split;

      if (candidate.length <= this.chunkSize) {
        currentChunk = candidate;
      } else {
        if (currentChunk) {
          finalChunks.push(currentChunk.trim());
        }

        if (split.length > this.chunkSize && newSeparators.length > 0) {
          const subChunks = this.recursiveSplit(split, newSeparators);
          finalChunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = split;
        }
      }
    }

    if (currentChunk.trim()) {
      finalChunks.push(currentChunk.trim());
    }

    return finalChunks;
  }
}
