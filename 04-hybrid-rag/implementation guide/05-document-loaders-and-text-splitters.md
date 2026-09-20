# ✂️ Chapter 5 — Document Loaders & Text Splitters

Welcome to Chapter 5 of the **Hybrid RAG Implementation Guide**. In this chapter, we explore how raw files are ingested and chunked into documents with character overlap.

All code snippets in this chapter are taken directly from [`04-hybrid-rag/code`](../code).

---

## 1. Document File Loader (`src/loaders/file-loader.ts`)

File: [`04-hybrid-rag/code/src/loaders/file-loader.ts`](../code/src/loaders/file-loader.ts)

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { Document } from '../schemas';

export class FileLoader {
  static loadFile(filePath: string): Document {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const filename = path.basename(absolutePath);
    const fileType = path.extname(absolutePath).slice(1);

    return {
      id: `doc_${filename}_${Date.now()}`,
      content,
      metadata: {
        source: absolutePath,
        filename,
        fileType,
        createdAt: new Date().toISOString()
      }
    };
  }

  static loadDirectory(dirPath: string): Document[] {
    const absoluteDir = path.resolve(dirPath);
    if (!fs.existsSync(absoluteDir) || !fs.statSync(absoluteDir).isDirectory()) {
      throw new Error(`Directory not found: ${absoluteDir}`);
    }

    const files = fs.readdirSync(absoluteDir);
    const documents: Document[] = [];

    for (const file of files) {
      const fullPath = path.join(absoluteDir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isFile() && (file.endsWith('.md') || file.endsWith('.txt'))) {
        documents.push(this.loadFile(fullPath));
      }
    }

    return documents;
  }
}
```

### Methods Explanation (`FileLoader`)
- `loadFile(filePath)`: Reads a target Markdown or text file from the local file system, extracts metadata (filename, file extension, creation timestamp), and wraps it in a standard `Document` instance.
- `loadDirectory(dirPath)`: Recursively scans a directory for `.md` and `.txt` files and loads them into a list of `Document` objects.

---

## 2. Recursive Character Text Splitter (`src/splitters/text-splitter.ts`)

File: [`04-hybrid-rag/code/src/splitters/text-splitter.ts`](../code/src/splitters/text-splitter.ts)

```typescript
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
```

### Methods Explanation (`RecursiveTextSplitter`)
- `splitText(text, separators)`: Splits text into chunks up to `chunkSize` (default: 500 chars) while respecting natural paragraph (`\n\n`) and line breaks (`\n`). Maintains `chunkOverlap` (default: 50 chars) across adjacent chunks to avoid breaking sentences mid-thought.
- `splitDocument(doc)`: Produces array of `Chunk` objects augmented with metadata (`startCharIndex`, `endCharIndex`, `tokenCount`, `chunkIndex`).

In [Chapter 6](./06-llm-generators-and-context-augmentation.md), we will inspect the **LLM Generators & Context Augmentation** module.
