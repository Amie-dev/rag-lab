import { Chunk, Document } from '../schemas';

export interface TextSplitterOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

export class RecursiveCharacterTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(options: TextSplitterOptions = {}) {
    this.chunkSize = options.chunkSize ?? 500;
    this.chunkOverlap = options.chunkOverlap ?? 50;
    this.separators = options.separators ?? ['\n\n', '\n', ' ', ''];
  }

  public splitDocument(doc: Document): Chunk[] {
    const rawChunks = this.splitText(doc.content, this.separators);
    const totalChunks = rawChunks.length;

    let charOffset = 0;

    return rawChunks.map((content, idx) => {
      const startCharIndex = doc.content.indexOf(content, charOffset);
      if (startCharIndex !== -1) {
        charOffset = startCharIndex + 1;
      }

      return {
        id: `${doc.id}_chunk_${idx}`,
        content,
        metadata: {
          ...doc.metadata,
          documentId: doc.id,
          chunkIndex: idx,
          totalChunks,
          startCharIndex: startCharIndex !== -1 ? startCharIndex : 0,
          endCharIndex: startCharIndex !== -1 ? startCharIndex + content.length : content.length,
          tokenCount: content.split(/\s+/).filter(Boolean).length,
        },
      };
    });
  }

  public splitDocuments(docs: Document[]): Chunk[] {
    const allChunks: Chunk[] = [];
    for (const doc of docs) {
      allChunks.push(...this.splitDocument(doc));
    }
    return allChunks;
  }

  private splitText(text: string, separators: string[]): string[] {
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

    const splits = separator !== '' ? text.split(separator) : text.split('');
    const goodSplits: string[] = [];

    for (const s of splits) {
      if (s.length < this.chunkSize) {
        goodSplits.push(s);
      } else {
        if (goodSplits.length > 0) {
          const merged = this.mergeSplits(goodSplits, separator);
          finalChunks.push(...merged);
          goodSplits.length = 0;
        }

        if (newSeparators.length === 0) {
          finalChunks.push(s);
        } else {
          const otherChunks = this.splitText(s, newSeparators);
          finalChunks.push(...otherChunks);
        }
      }
    }

    if (goodSplits.length > 0) {
      const merged = this.mergeSplits(goodSplits, separator);
      finalChunks.push(...merged);
    }

    return finalChunks;
  }

  private mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = [];
    const currentDoc: string[] = [];
    let totalLen = 0;

    for (const d of splits) {
      const len = d.length;
      if (totalLen + len + (currentDoc.length > 0 ? separator.length : 0) > this.chunkSize) {
        if (currentDoc.length > 0) {
          const docStr = currentDoc.join(separator).trim();
          if (docStr) docs.push(docStr);

          // Overlap window
          while (
            totalLen > this.chunkOverlap ||
            (totalLen + len + (currentDoc.length > 0 ? separator.length : 0) > this.chunkSize &&
              currentDoc.length > 0)
          ) {
            const removed = currentDoc.shift()!;
            totalLen -= removed.length + (currentDoc.length > 0 ? separator.length : 0);
          }
        }
      }

      currentDoc.push(d);
      totalLen += len + (currentDoc.length > 1 ? separator.length : 0);
    }

    if (currentDoc.length > 0) {
      const docStr = currentDoc.join(separator).trim();
      if (docStr) docs.push(docStr);
    }

    return docs;
  }
}
