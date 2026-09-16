# Chapter 3 — Chunking Strategies & Text Splitters

Chunking is the process of breaking large documents into smaller, coherent text snippets called **chunks**.

### Why is Chunking Necessary?
1. **Context Window Limits**: LLMs have maximum token limits.
2. **Retrieval Precision**: Large documents contain multiple unrelated topics. Embedding smaller, focused chunks ensures higher semantic similarity precision when searching for answers.
3. **Chunk Overlap**: Overlapping adjacent chunks (e.g. 50 characters/tokens) prevents contextual loss across boundary cuts.

In this chapter, we implement:
1. `src/splitters/base.ts` — The `TextSplitter` interface contract.
2. `src/splitters/character.ts` — `RecursiveCharacterTextSplitter`.
3. `src/splitters/token.ts` — `TokenTextSplitter`.

---

## 1. Text Splitter Interface (`src/splitters/base.ts`)

```typescript
import { Document, Chunk } from '../schemas';

export interface TextSplitter {
  /**
   * Split a single document into manageable chunks with overlap and metadata.
   */
  splitDocument(document: Document): Chunk[];

  /**
   * Batch split multiple documents.
   */
  splitDocuments(documents: Document[]): Chunk[];
}
```

---

## 2. Recursive Character Splitter (`src/splitters/character.ts`)

The `RecursiveCharacterTextSplitter` attempts to split text using a hierarchical list of separators (`["\n\n", "\n", ". ", " ", ""]`). It looks for natural paragraph breaks first, falling back to sentences, words, and finally individual characters.

### Full Source Code

```typescript
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
        // Look for the best separator boundary near the end index
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

      // Step forward by (end - overlap)
      start = end - this.chunkOverlap;
      if (start <= result[result.length - 1]?.startIndex) {
        start = result[result.length - 1].startIndex + 1;
      }
    }

    return result;
  }
}
```

---

## 3. Token-Aware Text Splitter (`src/splitters/token.ts`)

When working with LLM context windows, character count can vary. The `TokenTextSplitter` calculates chunk sizes based on estimated word tokens.

### Full Source Code

```typescript
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

        // Retain overlap words
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
```
