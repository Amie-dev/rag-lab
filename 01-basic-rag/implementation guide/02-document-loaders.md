# Chapter 2 — Document Loading Architecture

Document loaders represent the entry stage of the **Ingestion Phase**: taking raw data sources (local disk files, inline raw text strings, or directory structures) and transforming them into normalized `Document` objects containing raw text content and rich metadata.

In this chapter, we implement and test:
1. [src/loaders/base.ts](../code/src/loaders/base.ts) — The `DocumentLoader` strategy interface contract.
2. [src/loaders/text.ts](../code/src/loaders/text.ts) — Concrete `TextDocumentLoader` supporting files, inline strings, MIME type detection, and recursive directory scanning.
3. [tests/loaders.test.ts](../code/tests/loaders.test.ts) — Jest unit test suite validating document loader behavior.

---

## 1. Document Loader Interface ([src/loaders/base.ts](../code/src/loaders/base.ts))

Following the **Strategy Pattern** and **Interface Segregation Principle**, we define an abstract interface that any document loader implementation must satisfy.

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

### 💡 Code Explanation & Design Rationale

- **`load(filePathOrContent)`**: Asynchronous method accepting either a local file system path or an inline text string payload. Returns an array of normalized `Document[]` objects. Returning an array allows single loaders to return multiple documents when loading compound payloads.
- **`supportedExtensions()`**: Exposes an array of supported file extensions (e.g., `['.txt', '.md', '.json']`) allowing higher-level pipelines to filter directory files automatically.

---

## 2. Text & Directory Document Loader ([src/loaders/text.ts](../code/src/loaders/text.ts))

The `TextDocumentLoader` dynamically determines whether an input string is a valid file path on disk or inline text content. It reads the file safely, extracts extension-based MIME type metadata, and produces formatted `Document` instances.

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

### 💡 Line-by-Line Breakdown & Rationale

1. **Lines 53–55 (`supportedExtensions`)**:
   - Declares supported file types: `.txt`, `.md`, `.markdown`, `.log`, `.json`, `.csv`, `.html`.

2. **Lines 64–76 (Dual Disk vs Inline Check)**:
   - `fs.existsSync(filePathOrContent) && fs.statSync(filePathOrContent).isFile()`: Dynamically verifies if the input parameter points to an active file on the disk.
   - If true: Resolves absolute path (`source`), extracts file name (`filename`), reads UTF-8 content (`fs.readFileSync`), and maps file extensions (`.md` $\rightarrow$ `text/markdown`, `.json` $\rightarrow$ `application/json`, `.html` $\rightarrow$ `text/html`).
   - If false: Treats input string as raw text directly, setting `source = 'inline_text_input'`.

3. **Lines 78–80 (Empty Content Guard)**:
   - If content is empty or contains only whitespace (`!content.trim()`), returns an empty array `[]` to prevent indexing zero-length documents.

4. **Lines 82–95 (Unique ID Generation & Document Construction)**:
   - Generates a unique document ID: `doc_<timestamp>_<random_base36_hash>`.
   - Returns normalized `Document` object complete with source provenance and ISO timestamp.

5. **Lines 98–120 (`loadDirectory`)**:
   - Validates directory existence.
   - Iterates through files, filtering by supported extensions (`exts.includes(ext)`).
   - Recursively invokes `this.load(fullPath)` for each valid file, accumulating loaded documents into a unified list.

---

## 3. Document Loader Unit Tests ([tests/loaders.test.ts](../code/tests/loaders.test.ts))

The test suite validates inline content loading, disk file loading, and directory scanning using Jest.

### Full Source Code

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { TextDocumentLoader } from '../src/loaders/text';

describe('TextDocumentLoader', () => {
  const loader = new TextDocumentLoader();
  const tempDir = path.join(__dirname, 'temp_loader_test');
  const sampleFile = path.join(tempDir, 'test.txt');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(sampleFile, 'Hello World Basic RAG Test Document', 'utf-8');
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('loads document from inline string', async () => {
    const docs = await loader.load('Inline test content for RAG');
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('Inline test content for RAG');
    expect(docs[0].metadata.source).toBe('inline_text_input');
  });

  test('loads document from file path', async () => {
    const docs = await loader.load(sampleFile);
    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe('Hello World Basic RAG Test Document');
    expect(docs[0].metadata.filename).toBe('test.txt');
  });

  test('loads directory of files', async () => {
    const docs = await loader.loadDirectory(tempDir);
    expect(docs.length).toBeGreaterThanOrEqual(1);
  });
});
```

### 💡 Unit Test Coverage Summary
- **Lifecycle Management (`beforeAll` / `afterAll`)**: Creates a temporary directory and test file before running tests, and cleans up temporary files afterward.
- **Inline String Test**: Verifies raw string input correctly assigns `source: 'inline_text_input'`.
- **File Path Test**: Verifies file loading extracts correct content and sets `filename: 'test.txt'`.
- **Directory Test**: Verifies batch directory processing reads files inside a folder.
