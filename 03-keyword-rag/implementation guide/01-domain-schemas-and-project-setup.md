# 🛠️ Chapter 1 — Domain Schemas & Infrastructure Setup

Welcome to Chapter 1 of the **Keyword RAG Implementation Guide**. In this chapter, we set up the TypeScript project environment and define the core domain data contracts required for building an inverted index, text analysis pipeline, lexical scorers, and RAG retrieval pipeline.

---

## 1. Project Infrastructure & Configuration

The package relies on modern TypeScript targeting Node.js with ESM/CommonJS compatibility.

### `package.json` setup
Located in [`03-keyword-rag/code/package.json`](../code/package.json):

```json
{
  "name": "@rag-lab/keyword-rag",
  "version": "1.0.0",
  "description": "Production-grade Keyword / Sparse RAG engine implemented in TypeScript with BM25, TF-IDF, and Inverted Index",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "keyword-rag": "dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "ts-node src/cli.ts",
    "test": "jest",
    "test:coverage": "jest --coverage"
  }
}
```

---

## 2. Core Domain Data Contracts

All domain contracts are defined in [`03-keyword-rag/code/src/schemas.ts`](../code/src/schemas.ts).

### Documents and Chunks

```typescript
export interface DocumentMetadata {
  source: string;
  filename?: string;
  fileType?: string;
  createdAt?: string;
  category?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

export interface ChunkMetadata extends DocumentMetadata {
  documentId: string;
  chunkIndex: number;
  totalChunks?: number;
  startCharIndex?: number;
  endCharIndex?: number;
  tokenCount?: number;
}

export interface Chunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
}
```

### Inverted Index Posting & Tokens

An inverted index maps normalized terms to **Posting** entries detailing which documents contain the term, term frequency ($TF$), and exact positional offsets:

```typescript
export interface PositionedToken {
  term: string;
  rawTerm: string;
  position: number;
  startOffset: number;
  endOffset: number;
}

export interface Posting {
  docId: string;
  termFrequency: number;
  positions: number[];
  termOffsets?: Array<{ start: number; end: number }>;
}

export interface InvertedIndexStats {
  totalDocuments: number;
  totalTerms: number;
  vocabularySize: number;
  avgDocLength: number;
  docLengths: Record<string, number>;
}
```

### Scoring Hyperparameters & Explanations

```typescript
export type AnalyzerType = 'standard' | 'technical' | 'simple';
export type ScoringAlgorithm = 'bm25' | 'tfidf';

export interface BM25Params {
  k1: number;       // Term frequency saturation parameter (default: 1.2 or 1.5)
  b: number;        // Document length normalization parameter (default: 0.75)
  epsilon?: number; // IDF floor constant to prevent negative values
}

export interface TermScoreDetail {
  term: string;
  rawTf: number;
  idf: number;
  bm25Score: number;
  tfidfScore: number;
  scoreContribution: number;
}

export interface ScoreExplanation {
  chunkId: string;
  documentId: string;
  finalScore: number;
  algorithm: ScoringAlgorithm;
  termDetails: TermScoreDetail[];
  documentLength: number;
  avgDocumentLength: number;
}
```

### Retrieval & RAG Response Contracts

```typescript
export interface KeywordRetrievalResult {
  chunk: Chunk;
  score: number;
  bm25Score: number;
  tfidfScore: number;
  matchedTerms: string[];
  explanation?: ScoreExplanation;
}

export interface SearchQuery {
  query: string;
  topK?: number;
  algorithm?: ScoringAlgorithm;
  analyzerType?: AnalyzerType;
  filter?: MetadataFilter;
  bm25Params?: BM25Params;
  tfidfParams?: TFIDFParams;
  explain?: boolean;
}

export interface RAGResponse {
  question: string;
  answer: string;
  contextChunks: KeywordRetrievalResult[];
  metadata: {
    model: string;
    algorithm: ScoringAlgorithm;
    analyzerType: AnalyzerType;
    totalChunksIndexed: number;
    retrievalLatencyMs?: number;
    generationLatencyMs?: number;
    totalLatencyMs?: number;
  };
}
```

With our data contracts established, we proceed to Chapter 2 to build the multi-stage **Text Analysis Pipeline** (tokenization, stopword filtering, and stemming).
