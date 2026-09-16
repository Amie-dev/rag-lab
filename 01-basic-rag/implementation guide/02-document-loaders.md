# Chapter 2 — Document Loading Architecture

Document loaders are responsible for the first step of the **Ingestion Phase**: taking raw data sources (text files, Markdown documents, web pages, or raw string inputs) and converting them into normalized `Document` objects containing content and metadata.

In this chapter, we implement:
1. `src/loaders/base.ts` — The `DocumentLoader` interface contract.
2. `src/loaders/text.ts` — The concrete `TextDocumentLoader` supporting text, Markdown, HTML, JSON, and directory loading.

---

## 1. Document Loader Interface (`src/loaders/base.ts`)

Following the **Strategy Pattern** and **Interface Segregation Principle**, we define an abstract interface that any document loader must satisfy.

### Full Source Code

```typescript
import { Document } from '../schemas';

export interface DocumentLoader {
  /**
   * Load and extract structured Document from file path or content string.
   */
  load(filePathOrContent: string): Promise<Document[]>;

  /**
   * Supported file extensions (e.g., ['.txt', '.md']).
   */
  supportedExtensions(): string[];
}
```

### 💡 Code Explanation

- `load(filePathOrContent)`: Asynchronous method accepting either a local file system path or a raw text string. Returns an array of normalized `Document` objects.
- `supportedExtensions()`: Returns an array of file extensions that the loader can process.

---

## 2. Text & Directory Document Loader (`src/loaders/text.ts`)

The `TextDocumentLoader` checks whether the input string is a valid file path on disk or inline text content, reads the content safely, extracts file extension metadata, and returns formatted `Document` instances.

### Full Source Code

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { DocumentLoader } from './base';
import { Document } from '../schemas';

export class TextDocumentLoader implements DocumentLoader {
  supportedExtensions(): string[] {
    return ['.txt', '.md', '.markdown', '.log', '.json', '.csv', '.html'];
  }

  async load(filePathOrContent: string): Promise<Document[]> {
    let content: string;
    let source: string;
    let filename: string | undefined;
    let fileType = 'text/plain';

    // Check if input is an existing local file on disk
    if (fs.existsSync(filePathOrContent) && fs.statSync(filePathOrContent).isFile()) {
      source = path.resolve(filePathOrContent);
      filename = path.basename(filePathOrContent);
      content = fs.readFileSync(filePathOrContent, 'utf-8');
      
      const ext = path.extname(filePathOrContent).toLowerCase();
      if (ext === '.md' || ext === '.markdown') fileType = 'text/markdown';
      else if (ext === '.json') fileType = 'application/json';
      else if (ext === '.html') fileType = 'text/html';
    } else {
      source = 'inline_text_input';
      content = filePathOrContent;
    }

    if (!content.trim()) {
      return [];
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return [
      {
        id: docId,
        content: content.trim(),
        metadata: {
          source,
          filename,
          fileType,
          createdAt: new Date().toISOString(),
        },
      },
    ];
  }

  async loadDirectory(dirPath: string): Promise<Document[]> {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      throw new Error(`Directory path does not exist or is not a directory: ${dirPath}`);
    }

    const files = fs.readdirSync(dirPath);
    const documents: Document[] = [];
    const exts = this.supportedExtensions();

    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (exts.includes(ext)) {
          const docs = await this.load(fullPath);
          documents.push(...docs);
        }
      }
    }

    return documents;
  }
}
```

### 💡 Code Explanation & Key Details

1. **Smart File Detection**: `fs.existsSync(filePathOrContent)` allows the method to accept both raw text strings (e.g., `loader.load("Hello RAG")`) and file paths (`loader.load("./docs/readme.md")`).
2. **Metadata Enrichment**: Captures absolute file path, filename, detected MIME file type, and creation timestamp.
3. **Directory Processing (`loadDirectory`)**: Scans an entire folder, filters files by supported extensions, and ingests all matching documents in batch.
