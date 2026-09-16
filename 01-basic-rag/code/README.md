# 01 — Basic RAG (Naive RAG) Engine [TypeScript]

A production-grade, modular, fully-typed **Basic RAG (Naive RAG)** engine written in TypeScript.

It implements the foundational RAG pipeline:
1. **Ingestion Phase**: Document Loading -> Recursive/Token Chunking -> Embedding Model -> Vector Database
2. **Retrieval & Generation Phase**: User Question -> Query Vector Embedding -> Similarity Search (Cosine / Dot / Euclidean) -> Top-K Context Augmentation -> LLM Answer Synthesis

---

## 🏗️ Architecture

```
01-basic-rag/code/
├── src/
│   ├── index.ts               # Public exports & barrel file
│   ├── config.ts              # Configuration settings & environment loader
│   ├── schemas.ts             # Domain interfaces (Document, Chunk, VectorRecord, RAGResponse)
│   ├── loaders/
│   │   ├── base.ts            # DocumentLoader interface
│   │   └── text.ts            # Text, Markdown, CSV, HTML document loader
│   ├── splitters/
│   │   ├── base.ts            # TextSplitter interface
│   │   ├── character.ts       # Recursive character splitter
│   │   └── token.ts           # Token/Word-aware splitter
│   ├── embeddings/
│   │   ├── base.ts            # EmbeddingModel interface
│   │   ├── mock.ts            # Zero-dependency deterministic mock embedder
│   │   ├── openai.ts          # OpenAI embeddings API provider
│   │   └── gemini.ts          # Google Gemini embeddings API provider
│   ├── vectordb/
│   │   ├── base.ts            # VectorStore interface
│   │   └── inMemory.ts        # In-Memory Vector DB (Cosine, Dot Product, Euclidean)
│   ├── llm/
│   │   ├── base.ts            # LLMProvider interface
│   │   ├── mock.ts            # Mock LLM provider (offline zero API key)
│   │   ├── openai.ts          # OpenAI LLM provider (gpt-4o-mini, etc.)
│   │   └── gemini.ts          # Gemini LLM provider (gemini-1.5-flash, etc.)
│   ├── pipeline/
│   │   ├── ingestion.ts       # Document indexing pipeline
│   │   ├── retrieval.ts       # Similarity retrieval engine
│   │   ├── generation.ts      # Context prompt builder & answer generation
│   │   └── basicRag.ts        # BasicRAGPipeline main facade
│   └── cli.ts                 # Interactive Command-Line application
├── tests/                     # Unit test suite (Jest + ts-jest)
└── sample_data/               # Sample knowledge base documents
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Build TypeScript Code
```bash
npm run build
```

### 3. Run Unit Tests
```bash
npm test
```

---

## 💻 CLI Usage

You can run the interactive CLI immediately without setting up external API keys (uses deterministic Mock Embedder & LLM):

### Ingest Documents
```bash
npx ts-node src/cli.ts ingest --path sample_data/
```

### Ask a Question
```bash
npx ts-node src/cli.ts ask --question "What is Basic RAG architecture?" --top-k 2
```

---

## 🔧 SDK Example (TypeScript)

```typescript
import { BasicRAGPipeline } from '@rag-lab/basic-rag';

async function main() {
  const pipeline = new BasicRAGPipeline({
    chunkSize: 500,
    chunkOverlap: 50,
    topK: 3,
    similarityMetric: 'cosine',
    embeddingProvider: 'mock', // 'openai', 'gemini', or 'mock'
    llmProvider: 'mock',
  });

  // 1. Ingest document content
  await pipeline.ingest(`
    Basic RAG connects vector store retrieval with an LLM.
    Top-K most relevant chunks are retrieved using cosine similarity search.
  `);

  // 2. Query knowledge base
  const response = await pipeline.query("How does Basic RAG retrieve context?");

  console.log("Answer:", response.answer);
  console.log("Retrieved Chunks:", response.contextChunks.length);
}

main();
```

---

## 🔑 Environment Variables (.env)

Copy `.env.example` to `.env` to configure OpenAI or Gemini providers:

```env
OPENAI_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
RAG_EMBEDDING_PROVIDER=openai
RAG_LLM_PROVIDER=openai
```
