# Keyword / Sparse RAG Engine

A production-grade **Keyword / Sparse RAG Engine** implemented in TypeScript with full BM25 ranking, TF-IDF scoring, inverted indexing with positional tracking, multi-analyzer support (standard, technical/code, simple), exact identifier matching, metadata filtering, explainable scoring breakdown, and LLM integration.

## 🌟 Key Features

* **Inverted Index Engine**: Complete inverted index data structure supporting document frequency (`df`), collection term frequency (`ttf`), document length normalization (`avgdl`), positional offsets, and JSON serialization.
* **BM25 Scoring (Robertson Formula)**: Full implementation of BM25 ranking algorithm with configurable term frequency saturation ($k_1$) and document length normalization ($b$).
* **TF-IDF Scoring**: Inverse document frequency scoring with sublinear scaling and smooth IDF calculation.
* **Advanced Analyzer Pipeline**:
  * **Standard Analyzer**: Lowercasing, stop word filtering, and Porter stemming.
  * **Technical / Code Analyzer**: Preserves technical error codes (`ERR_CONNECTION_TIMED_OUT`, `0x80004005`), API paths (`POST /api/v1/users`), camelCase and snake_case tokens, and product SKUs (`TX-9021-B`).
  * **Simple Analyzer**: Basic whitespace and punctuation tokenization without aggressive stemming.
* **Explainable Search**: Detailed breakdown of score contributions per term ($TF$, $IDF$, BM25 term weight) for full auditability.
* **Metadata Filtering**: Query-level filtering on custom metadata fields using `$eq`, `$ne`, `$in`, `$gt`, `$gte`, `$lt`, `$lte`.
* **LLM RAG Integration**: Supports OpenAI API and offline Mock LLM providers with citation tracking.
* **CLI Utility**: Command-line tools for indexing, searching, explaining scores, and running RAG queries.

## 🚀 Quick Start

### Installation

```bash
npm install
npm run build
```

### Running Tests

```bash
npm test
```

### CLI Commands

```bash
# Index sample technical documentation and ask a question
npm start -- query "What causes ERR_CONNECTION_TIMED_OUT and how to resolve it?" --file sample_data/technical_docs.md

# Perform BM25 search with score explanation
npm start -- search "createPaymentIntent" --file sample_data/technical_docs.md --explain --topK 3
```

## 🏗️ Architecture

```
src/
├── schemas.ts           # Types & interfaces for documents, chunks, postings, scores
├── analysis/            # Analyzers, tokenizers, stemmer, stop words
│   ├── tokenizer.ts
│   ├── stemmer.ts
│   ├── stopwords.ts
│   └── analyzer.ts
├── index/               # Inverted Index data structure & persistence
│   └── inverted_index.ts
├── scoring/             # Scoring algorithms (BM25, TF-IDF, IDF variations)
│   ├── idf.ts
│   ├── bm25.ts
│   └── tfidf.ts
├── search/              # Lexical search engine & metadata filtering
│   └── engine.ts
├── loaders/             # Document loaders (Markdown, Text, Directory)
│   └── file.ts
├── splitters/           # Text splitters (Character, Recursive)
│   └── text_splitter.ts
├── llm/                 # LLM Providers (OpenAI, Mock)
│   ├── base.ts
│   ├── openai.ts
│   └── mock.ts
├── pipeline/            # RAG Pipeline orchestration
│   └── rag_pipeline.ts
├── cli.ts               # Command Line Interface
└── index.ts             # Library entry point
```
