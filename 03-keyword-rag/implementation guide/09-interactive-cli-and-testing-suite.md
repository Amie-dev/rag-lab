# 🖥️ Chapter 9 — Interactive CLI & Unit Testing Suite

Welcome to Chapter 9 of the **Keyword RAG Implementation Guide**. In this final chapter, we explore the CLI tool interface and the unit testing suite that validates the correctness of our lexical retrieval engine.

---

## 1. CLI Commands (`cli.ts`)

Located in [`03-keyword-rag/code/src/cli.ts`](../code/src/cli.ts):

Built with Commander.js, the CLI exposes three primary commands:

### 1. `search`
Executes raw BM25 or TF-IDF lexical search without calling an LLM:
```bash
npx ts-node src/cli.ts search "bm25 term frequency" --explain --topK 3
```

### 2. `query`
Runs the end-to-end Keyword RAG pipeline, generating a context-augmented answer with citations:
```bash
npx ts-node src/cli.ts query "How does document length normalization work?" --algorithm bm25
```

### 3. `stats`
Displays inverted index statistics:
```bash
npx ts-node src/cli.ts stats
```

Output:
```
📊 Inverted Index Statistics:
  - Total Documents/Chunks: 12
  - Total Tokens: 2450
  - Vocabulary Size (Unique Terms): 620
  - Average Document Length: 204.17 tokens
```

---

## 2. Unit Testing Suite (`tests/`)

Located in [`03-keyword-rag/code/tests/`](../code/tests/):

The test suite contains 5 Jest test suites with 17 tests:

| Test Suite File | Tested Functionality | Key Assertions |
| :--- | :--- | :--- |
| **`analyzer.test.ts`** | Tokenization, stemming, stop words | Verifies Porter Stemmer root reduction and technical token preservation (`ERR_404`) |
| **`inverted_index.test.ts`** | Posting lists, DF/CTF stats | Validates term posting indexing, document deletion, and index serialization/deserialization |
| **`scoring.test.ts`** | BM25 & TF-IDF scoring | Asserts that rare terms yield higher IDF and BM25 scores saturate with higher frequency |
| **`search_engine.test.ts`** | Retrieval ranking & metadata filters | Confirms top-ranked chunks match query terms and metadata filters (`$eq`) enforce constraints |
| **`pipeline.test.ts`** | End-to-end RAG pipeline | Verifies ingestion, search, and Mock LLM answer generation with latency metadata |

### Running Tests:
```bash
npm test
```

All 5 test suites pass cleanly with 100% success rate across all components.

---

## 🎉 Conclusion

You have completed the **Keyword RAG Implementation Guide**! You now possess a deep understanding of lexical search mathematical formulations, inverted index postings lists, Okapi BM25 scoring, text analysis pipelines, context-augmented LLM generation, and pipeline orchestration.
