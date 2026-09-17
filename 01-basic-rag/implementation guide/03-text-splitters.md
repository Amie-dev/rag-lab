# Chapter 3 — Chunking Strategies & Text Splitters

Chunking is the process of splitting large documents into smaller, contiguous text snippets called **chunks**. 

In this chapter, we cover the mathematical principles of chunking and implement:
1. [src/splitters/base.ts](../code/src/splitters/base.ts) — The `TextSplitter` interface contract.
2. [src/splitters/character.ts](../code/src/splitters/character.ts) — `RecursiveCharacterTextSplitter` with hierarchical separator fallback.
3. [src/splitters/token.ts](../code/src/splitters/token.ts) — `TokenTextSplitter` based on word-token estimation.
4. [tests/splitters.test.ts](../code/tests/splitters.test.ts) — Jest unit test suite for text splitters.

---

## 1. Why Chunking is Necessary

```text
Raw Document (10,000 words) ──► [ Chunk 1 (500 chars) ] ──► Embedding 1
                             ──► [ Chunk 2 (500 chars) ] ──► Embedding 2
                             ──► [ Chunk 3 (500 chars) ] ──► Embedding 3
```

1. **LLM Context Window Limits**: Large Language Models have maximum token limits. Passing an entire book or lengthy manual exceeds context windows and increases latency and operational cost.
2. **Retrieval Precision**: Large documents cover multiple topics. Splitting text into focused chunks ensures that vector similarity search targets only the specific paragraphs relevant to the user's query.
3. **Chunk Overlap**: Overlapping adjacent chunks by $O$ characters/tokens preserves context across boundary split points.

### Sliding Window Overlap Formula

Given a document of length $L$, target chunk size $C$, and chunk overlap $O$ (where $0 \le O < C$), the step size $S$ is defined as:

$$ S = C - O $$

The start index $I_k$ for chunk index $k$ is computed recursively:

$$ I_0 = 0, \quad I_k = I_{k-1} + (C - O) = k \cdot (C - O) $$

---

## 2. Text Splitter Interface ([src/splitters/base.ts](../code/src/splitters/base.ts))

### Full Source Code

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

## 3. Recursive Character Splitter ([src/splitters/character.ts](../code/src/splitters/character.ts))

The `RecursiveCharacterTextSplitter` attempts to split text using a hierarchical list of separators (`["\n\n", "\n", ". ", " ", ""]`). It looks for natural paragraph breaks (`"\n\n"`) first, falling back to line breaks (`"\n"`), sentence boundaries (`". "`), word spaces (`" "`), and finally individual characters (`""`).

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

### 💡 Line-by-Line Breakdown & Key Details

1. **Lines 63–65 (Validation Guard)**:
   - Enforces `chunkOverlap < chunkSize`. If overlap were greater than or equal to chunk size, the sliding window loop would stall or regress infinitely.

2. **Lines 68–94 (`splitDocument`)**:
   - Accepts a `Document`, extracts raw `text`, and runs `splitText()`.
   - Maps each raw string slice into a strongly-typed `Chunk` object, creating a unique ID (`${doc.id}_chunk_${index}`) and setting character range provenance (`startCharIndex`, `endCharIndex`).

3. **Lines 100–146 (`splitText` algorithm)**:
   - **Lines 105–123 (Separator Search)**: Advances window end pointer by `chunkSize`. If `end` falls within text length, it scans backwards (`text.lastIndexOf(sep, end)`) using hierarchical separators to locate a clean break (such as a paragraph boundary `\n\n` or period `. `) instead of slicing words mid-character.
   - **Lines 138–143 (Sliding Step)**: Steps forward by `start = end - this.chunkOverlap`. Contains a fallback safety guard (`start = result[result.length - 1].startIndex + 1`) to guarantee forward progress even if trailing whitespace trims cause index collisions.

---

## 4. Token-Aware Text Splitter ([src/splitters/token.ts](../code/src/splitters/token.ts))

When interfacing with LLMs, token count is more accurate than character count. `TokenTextSplitter` calculates chunk bounds using token estimation ($1 \text{ token} \approx 4 \text{ characters}$).

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

### 💡 Code Explanation & Key Details

1. **Word Token Estimation (`Math.ceil(word.length / 4) || 1`)**:
   - Splitting by word whitespace delimiter `/(\s+)/` captures text words and whitespace.
   - Calculates token count estimate per word, ensuring sub-word tokens or short punctuation count as at least 1 token.

2. **Overlap Queue Sliding Window**:
   - When cumulative token estimate reaches `maxTokens`, the chunk is recorded.
   - Operates a reverse loop over `currentWords` to build an `overlapWords` array containing up to `overlapTokens` worth of text, maintaining seamless context continuity between adjacent chunks.

---

## 5. Text Splitter Unit Tests ([tests/splitters.test.ts](../code/tests/splitters.test.ts))

### Full Source Code

```typescript
import { RecursiveCharacterTextSplitter } from '../src/splitters/character';
import { TokenTextSplitter } from '../src/splitters/token';
import { Document } from '../src/schemas';

describe('TextSplitters', () => {
  const doc: Document = {
    id: 'doc_1',
    content: 'Paragraph 1: Basic RAG connects vector DB to LLM.\n\nParagraph 2: Chunking splits large documents into smaller pieces so they can be embedded accurately.',
    metadata: { source: 'unit_test' },
  };

  test('RecursiveCharacterTextSplitter chunks text with overlap', () => {
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 60, chunkOverlap: 10 });
    const chunks = splitter.splitDocument(doc);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata.documentId).toBe('doc_1');
    expect(chunks[0].metadata.chunkIndex).toBe(0);
  });

  test('TokenTextSplitter chunks text based on estimated tokens', () => {
    const splitter = new TokenTextSplitter({ maxTokens: 10, overlapTokens: 2 });
    const chunks = splitter.splitDocument(doc);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata.documentId).toBe('doc_1');
  });
});
```

### 💡 Test Assertions Breakdown
- Verifies that both `RecursiveCharacterTextSplitter` and `TokenTextSplitter` break long paragraphs into multiple chunks (`length > 1`).
- Confirms that chunk metadata contains correct parent `documentId` and initial `chunkIndex`.
