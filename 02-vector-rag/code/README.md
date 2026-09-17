# 02 — Vector RAG Engine [TypeScript]

A production-grade, modular, fully-typed **Vector RAG (Retrieval-Augmented Generation)** engine implemented in TypeScript with pure TypeScript implementations of modern **Approximate Nearest Neighbor (ANN)** indexing algorithms:
- **Flat Index**: Exact brute-force search (100% recall baseline).
- **HNSW Index**: Hierarchical Navigable Small World multi-layer graph search ($O(\log N)$ ANN retrieval).
- **IVF Index**: Inverted File Index with K-means centroid clustering and Voronoi cell probing.

---

## 🏗️ Architecture & Pipeline Flow

```
02-vector-rag/code/
├── src/
│   ├── index.ts               # Package barrel exports
│   ├── schemas.ts             # Domain interfaces (Document, Chunk, VectorRecord, IndexConfig)
│   ├── math/
│   │   └── vectorMath.ts      # Cosine, Dot Product, Euclidean (L2), Manhattan (L1), L2 Norm
│   ├── indexes/
│   │   ├── base.ts            # VectorIndex interface
│   │   ├── flat.ts            # Brute-force exact ANN search
│   │   ├── hnsw.ts            # Multi-layer HNSW graph ANN index
│   │   └── ivf.ts             # Inverted File K-means ANN index
│   ├── vectordb/
│   │   ├── filter.ts          # MongoDB-style metadata payload filtering ($eq, $gte, $in, $and, $or)
│   │   └── vectorStore.ts     # VectorStore manager & JSON persistence
│   ├── loaders/
│   │   └── text.ts            # File & directory document loader
│   ├── splitters/
│   │   └── character.ts       # Recursive character text splitter with overlap
│   ├── embeddings/
│   │   ├── base.ts            # EmbeddingModel interface
│   │   ├── mock.ts            # Deterministic 128-d semantic hash mock embedder (zero API key)
│   │   ├── openai.ts          # OpenAI embeddings (text-embedding-3-small / large)
│   │   └── gemini.ts          # Google Gemini embeddings (text-embedding-004)
│   ├── llm/
│   │   ├── base.ts            # LLMProvider interface
│   │   ├── mock.ts            # Deterministic mock LLM
│   │   ├── openai.ts          # OpenAI Chat Completion (gpt-4o-mini / gpt-4o)
│   │   └── gemini.ts          # Google Gemini Chat Completion (gemini-1.5-flash)
│   ├── pipeline/
│   │   ├── vectorRag.ts       # VectorRAGPipeline main facade
│   │   └── benchmark.ts       # ANN Index recall & latency performance benchmarker
│   └── cli.ts                 # CLI executable app
├── tests/                     # Jest unit test suite
└── sample_data/               # Sample knowledge documents
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

You can run the interactive CLI immediately without setting up external API keys (uses deterministic Mock Embedder & Mock LLM):

### 1. Ingest Documents
```bash
npx ts-node src/cli.ts ingest --path sample_data/ --index-type hnsw
```

### 2. Ask a Question
```bash
npx ts-node src/cli.ts ask --question "How do I take care of a domestic cat?" --top-k 3 --index-type hnsw --metric cosine
```

### 3. Benchmark ANN Indexes (Flat vs HNSW vs IVF)
```bash
npx ts-node src/cli.ts benchmark --size 150 --top-k 5
```

---

## 🔧 SDK Example (TypeScript)

```typescript
import { VectorRAGPipeline } from '@rag-lab/vector-rag';

async function main() {
  const pipeline = new VectorRAGPipeline({
    indexType: 'hnsw',
    similarityMetric: 'cosine',
    topK: 3,
    embeddingProvider: 'mock', // 'mock', 'openai', or 'gemini'
    llmProvider: 'mock',
  });

  // 1. Ingest document text
  await pipeline.ingest(`
    Feline domestic cat care requires high quality nutrition, clean water, and regular veterinary care.
    Scratching posts and interactive toys provide vital indoor environmental enrichment.
  `);

  // 2. Query system
  const response = await pipeline.query("What nutrition and care do domestic cats need?");

  console.log("Answer:", response.answer);
  console.log("Retrieved Chunks:", response.contextChunks.length);
  console.log("Retrieval Latency:", response.metadata.retrievalLatencyMs, "ms");
}

main();
```

---

## 🔑 Environment Variables (.env)

Copy `.env.example` to `.env` to configure OpenAI or Gemini API providers:

```env
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
RAG_EMBEDDING_PROVIDER=mock
RAG_LLM_PROVIDER=mock
RAG_INDEX_TYPE=hnsw
```
