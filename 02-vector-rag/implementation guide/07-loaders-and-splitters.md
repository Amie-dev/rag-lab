# Chapter 7 — Document Loading & Text Chunking Strategies

Vector RAG systems process raw source files by reading them into standard `Document` objects and splitting long documents into smaller, semantically coherent `Chunk` items suitable for embedding models.

Source code locations:
- [`src/loaders/text.ts`](../code/src/loaders/text.ts)
- [`src/splitters/character.ts`](../code/src/splitters/character.ts)

---

## 1. Document Loading Architecture

`FileDocumentLoader` parses single files or recursively scans directories for supported document formats (`.txt`, `.md`, `.json`, `.csv`, `.html`):

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { Document } from '../schemas';

export class FileDocumentLoader {
  private filePathOrDir: string;

  constructor(filePathOrDir: string) {
    this.filePathOrDir = filePathOrDir;
  }

  public async load(): Promise<Document[]> {
    const stats = await fs.promises.stat(this.filePathOrDir);
    if (stats.isDirectory()) {
      return this.loadDirectory(this.filePathOrDir);
    } else {
      return [await this.loadFile(this.filePathOrDir)];
    }
  }

  private async loadFile(filePath: string): Promise<Document> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const filename = path.basename(filePath);
    const ext = path.extname(filePath).replace('.', '');

    return {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      content,
      metadata: {
        source: filePath,
        filename,
        fileType: ext,
        createdAt: new Date().toISOString(),
      },
    };
  }
}
```

---

## 2. Recursive Character Text Splitter with Overlap

The `RecursiveCharacterTextSplitter` splits document text hierarchically using natural boundary separators (`["\n\n", "\n", " ", ""]`), keeping chunk character size below `chunkSize` while preserving `chunkOverlap` context windows across chunk boundaries:

```typescript
import { Chunk, Document } from '../schemas';

export class RecursiveCharacterTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(options: { chunkSize?: number; chunkOverlap?: number; separators?: string[] } = {}) {
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
      if (startCharIndex !== -1) charOffset = startCharIndex + 1;

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
}
```
