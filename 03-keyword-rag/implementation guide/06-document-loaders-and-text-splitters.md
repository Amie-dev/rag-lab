# 📑 Chapter 6 — Document Loaders & Text Splitters

Welcome to Chapter 6 of the **Keyword RAG Implementation Guide**. In this chapter, we explore how raw text documents are read from filesystem paths and chunked into overlapping passages suitable for inverted indexing.

---

## 1. Document Ingestion Architecture

Before text can be tokenized and added to an inverted index, it must be loaded into memory as structured `Document` objects and partitioned into `Chunk` objects:

```
[ Disk Files (.md, .txt) ] ──► [ DocumentLoader ] ──► [ TextSplitter ] ──► [ Chunks Array ]
```

---

## 2. Document Loaders (`loaders/file.ts`)

Located in [`03-keyword-rag/code/src/loaders/file.ts`](../code/src/loaders/file.ts):

- **`TextFileLoader`**: Reads single plain text files and constructs metadata (`filename`, `fileType`, `createdAt`, `source`).
- **`MarkdownLoader`**: Extends `TextFileLoader` with `fileType: 'markdown'`.
- **`DirectoryLoader`**: Recursively scans directories, filtering by extension (`.md`, `.txt`), returning aggregated `Document[]`.

---

## 3. Text Chunking Strategies (`splitters/text_splitter.ts`)

Located in [`03-keyword-rag/code/src/splitters/text_splitter.ts`](../code/src/splitters/text_splitter.ts):

### `RecursiveCharacterTextSplitter`
Recursively splits large text passages using hierarchy separators (`["\n\n", "\n", " ", ""]`) to respect paragraph and sentence boundaries while keeping chunk length below `chunkSize` (default 500 characters) with sliding window `chunkOverlap` (default 50 characters).

```typescript
export class RecursiveCharacterTextSplitter extends TextSplitter {
  private separators: string[];

  constructor(options: TextSplitterOptions = {}) {
    super(options);
    this.separators = options.separators ?? ['\n\n', '\n', ' ', ''];
  }

  public splitText(text: string): string[] {
    return this.recursiveSplit(text, this.separators);
  }
}
```

Every generated `Chunk` preserves its parent document ID, chunk index, character offsets, and estimated token counts in its `ChunkMetadata`.

In Chapter 7, we examine **Context-Augmented LLM Response Generation**.
