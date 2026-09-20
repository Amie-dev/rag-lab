# 🗄️ Chapter 3 — Inverted Index Architecture

Welcome to Chapter 3 of the **Keyword RAG Implementation Guide**. In this chapter, we inspect the core data structure of lexical information retrieval: the **Inverted Index**.

---

## 1. What is an Inverted Index?

A forward index maps a document to the words it contains ($d_1 \to \{w_1, w_2, w_3\}$).
An **Inverted Index** flips this relationship, mapping each unique dictionary word to a **Postings List** of documents containing that word ($w_1 \to \{d_1, d_4, d_9\}$).

```
Term Dictionary                  Postings Lists
┌──────────────┐                 ┌─────────────────────────────────────────────────────┐
│ "bm25"       │ ──────────────► │ docId: "chunk_1", tf: 3, positions: [4, 12, 45]     │
│              │                 │ docId: "chunk_7", tf: 1, positions: [102]           │
├──────────────┤                 ├─────────────────────────────────────────────────────┤
│ "retrieval"  │ ──────────────► │ docId: "chunk_1", tf: 2, positions: [2, 33]         │
│              │                 │ docId: "chunk_3", tf: 5, positions: [0, 8, 14, ...] │
└──────────────┘                 └─────────────────────────────────────────────────────┘
```

---

## 2. Inverted Index Internal Data Structures

Located in [`03-keyword-rag/code/src/index/inverted_index.ts`](../code/src/index/inverted_index.ts):

```typescript
export class InvertedIndex {
  // Term Dictionary: term -> Map<docId, Posting>
  private index: Map<string, Map<string, Posting>> = new Map();

  // Document Frequency per term: term -> number of docs containing term
  private docFrequency: Map<string, number> = new Map();

  // Collection Term Frequency: term -> total occurrences across all docs
  private collectionTermFrequency: Map<string, number> = new Map();

  // Chunk length in tokens: docId -> token count
  private docLengths: Map<string, number> = new Map();

  // Document chunks store: docId -> Chunk object
  private chunks: Map<string, Chunk> = new Map();

  // Total token volume across all chunks
  private totalTokens = 0;
}
```

---

## 3. Indexing & Postings Construction (`addChunk`)

When a document chunk and its analyzed tokens pass into `addChunk(chunk, tokens)`:

1. **Token Grouping**: Tokens are grouped by term to calculate raw term frequency ($TF$) and collect positional offsets:
   ```typescript
   const termMap = new Map<string, { tf: number; positions: number[]; offsets: Array<{ start: number; end: number }> }>();
   for (const token of tokens) {
     let entry = termMap.get(token.term);
     if (!entry) {
       entry = { tf: 0, positions: [], offsets: [] };
       termMap.set(token.term, entry);
     }
     entry.tf += 1;
     entry.positions.push(token.position);
     entry.offsets.push({ start: token.startOffset, end: token.endOffset });
   }
   ```
2. **Posting Map Insertion**: For each unique term, the posting record is attached to `this.index.get(term)`.
3. **Stat Maintenance**: Increments `docFrequency`, `collectionTermFrequency`, `docLengths`, and `totalTokens`.

---

## 4. Deletion & Persistence

- **`removeChunk(chunkId)`**: Decrements document frequency and collection term frequency. Deletes orphaned terms from dictionary.
- **`serialize()` / `deserialize()`**: Converts in-memory `Map` objects into JSON-friendly records.
- **`saveToFile(path)` / `loadFromFile(path)`**: Persists index states directly to disk for zero-reindexing fast cold starts.

---

## 5. Statistical Calculations

- **`getAvgDocLength()`**: Calculates mean chunk length:
  $$\text{avgdl} = \frac{\text{totalTokens}}{\text{chunks.size}}$$
- **`getStats()`**: Returns index summary report (`InvertedIndexStats`).

In the next chapter, we implement the scoring formulas (**TF-IDF** and **Okapi BM25**) that consume these posting lists.
