# 09 — Parent-Document RAG Engine

> **Production-grade Parent-Document RAG Engine** written in TypeScript with an Express REST API, OpenAI SDK Structured Outputs, hierarchical parent/child chunking, hybrid (dense + BM25) retrieval, cross-encoder reranking, parent resolution with context budgeting, comparative benchmarks, and an interactive CLI.

---

## 🏗️ Architecture Overview

Parent-Document RAG separates the **retrieval unit** (small children) from the **generation context** (large parents):

```text
Raw Document
     ↓
Parent Chunker        ──────────────►  Parent Store            (generation context)
     ↓                                       ▲
Child Chunker                                │ parentId lookup
     ↓                                       │
Child Embeddings  ──►  Child Vector Index    │
     ↓                                       │
Query ─► Embed ─► Child Retrieval (Dense + BM25) ─► Fusion ─► Rerank
     ↓
Top-K Child Candidates
     ↓
Resolve Child → Parent (dedup + context budget)
     ↓
Parent Contexts  ────────────────────────────┘
     ↓
Generation LLM (Structured Output Zod validation)
     ↓
Final Grounded Answer
```

> 🔑 **Core idea**: *Search small → Retrieve large → Generate with complete context.*
> Children are optimized for **finding**; parents are optimized for **understanding**.

> ⚠️ **Architectural guarantee**: the generation LLM only ever receives **real parent chunks**. Children are used exclusively for retrieval and are never injected as generation evidence.

---

## 🛠️ Features

- **Hierarchical Parent/Child Chunking**: Larger, coherent parent sections with small, precise child chunks — each child carries a strict `parentId`/`documentId` reference.
- **Child-Level Retrieval**: Dense vector search and BM25 sparse search over the child index, with RRF / score-weighted / max-score fusion.
- **Hybrid Retrieval**: Combines dense semantic similarity with BM25 lexical matching for terminology, IDs, and names.
- **Cross-Encoder Reranker**: Reorders child candidates against the original query *before* parent resolution so the most relevant parents survive truncation.
- **Parent Resolution & Deduplication**: Collapses multiple matching children into unique parents and aggregates evidence into a parent-level ranking score.
- **Context Budgeting**: Enforces `maxParents` and a token budget so parent context never blows the LLM window.
- **OpenAI Structured Outputs**: Uses `zodResponseFormat` for strict JSON answer-schema validation.
- **Zero-Dependency Local Fallback**: Runs fully offline using a deterministic, L2-normalized hashing embedding and a local answer synthesizer when `OPENAI_API_KEY` is unset.
- **Comparative Benchmarks**: Quantifies the **context completeness** gain of Parent-Document RAG over standard child-only RAG.
- **Express REST API + Interactive CLI**.

---

## 🚀 Quick Start

### 1. Installation

```bash
cd 09-parent-document-rag/code
npm install
```

### 2. Environment Setup

Create `.env` (optional — the system works with the local fallback when the OpenAI key is omitted):

```bash
cp .env.example .env
```

```env
PORT=3000
NODE_ENV=development
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_COMPLETION_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Hierarchical chunking (sizes in characters, ~4 chars/token)
DEFAULT_PARENT_CHUNK_SIZE=1500
DEFAULT_PARENT_CHUNK_OVERLAP=200
DEFAULT_CHILD_CHUNK_SIZE=350
DEFAULT_CHILD_CHUNK_OVERLAP=60

# Retrieval / resolution
DEFAULT_CHILD_TOP_K=12
DEFAULT_FINAL_CHILD_TOP_K=8
DEFAULT_MAX_PARENTS=4
DEFAULT_MAX_CONTEXT_TOKENS=3000
DEFAULT_ENABLE_RERANKING=true
```

### 3. Build & Test

```bash
# Compile TypeScript to dist/
npm run build

# Run the Jest unit and integration test suite
npm run test

# Run with coverage thresholds enforced
npm run test:coverage
```

---

## 💻 CLI Usage

```bash
# 1. Inspect the ingested parent/child hierarchy
npx ts-node src/cli.ts inspect

# 2. Retrieve child candidates and resolve them to parent contexts
npx ts-node src/cli.ts search "How many sick leaves can an employee take?" --max-parents 3

# 3. Execute the end-to-end grounded Parent-Document RAG pipeline
npx ts-node src/cli.ts ask "When is the subscription renewed automatically?"

# 4. Run the comparative Standard vs Parent-Document benchmark suite
npx ts-node src/cli.ts benchmark

# 5. Ingest a custom document JSON dataset
npx ts-node src/cli.ts ingest --file sample_data/documents.json
```

---

## 🌐 REST API Specification

```bash
npm run start
# Server listens on http://localhost:3000/api/v1/parent-document
```

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/parent-document/health` | Health check & knowledge-base status |
| `GET` | `/api/v1/parent-document/documents` | List indexed child chunks |
| `GET` | `/api/v1/parent-document/parents` | List stored parent chunks |
| `POST` | `/api/v1/parent-document/documents/ingest` | Bulk ingest documents (builds the hierarchy) |
| `POST` | `/api/v1/parent-document/search` | Child retrieval + parent resolution (no generation) |
| `POST` | `/api/v1/parent-document/rag` | Full end-to-end Parent-Document RAG answer synthesis |
| `POST` | `/api/v1/parent-document/benchmark` | Comparative strategy benchmark suite |

### Example Request (`POST /api/v1/parent-document/rag`)

```json
{
  "question": "When is the subscription renewed automatically?",
  "childTopK": 12,
  "finalChildTopK": 8,
  "maxParents": 4,
  "maxContextTokens": 3000,
  "fusionStrategy": "rrf",
  "retrievalMode": "hybrid",
  "enableReranking": true,
  "scoreAggregation": "mean_child"
}
```

---

## 📊 Comparative Benchmark Output

Run `npm run cli benchmark` to compare:

1. **Standard RAG (Child-Only)**
2. **Parent-Document RAG**
3. **Parent-Document RAG + Reranker**

Sample output:

```text
┌──────────────────────────────────┬──────────────┬──────────┬──────────────────┬────────────────┬──────────────┬────────────┐
│ Strategy                         │ Latency (ms) │ Children │ Parents Resolved │ Context Tokens │ Completeness │ Confidence │
├──────────────────────────────────┼──────────────┼──────────┼──────────────────┼────────────────┼──────────────┼────────────┤
│ Standard RAG (Child-Only)        │ 3            │ 4        │ 0                │ 299            │ 0.6291       │ 0.8144     │
│ Parent-Document RAG              │ 2            │ 4        │ 2                │ 725            │ 1.0000       │ 0.9300     │
│ Parent-Document RAG + Reranker   │ 2            │ 3        │ 1                │ 438            │ 1.0000       │ 0.9700     │
└──────────────────────────────────┴──────────────┴──────────┴──────────────────┴────────────────┴──────────────┴────────────┘

📈 Context Completeness Gain: +59% over the child-only baseline
```

> **Context completeness** = the fraction of the relevant parent section actually delivered to the LLM.
> The child-only baseline delivers only its top fragments (≈63% of the section), whereas
> Parent-Document RAG delivers the complete coherent section (100%).

---

## 📁 Project Structure

```text
src/
├── config/environment.ts             # Zod-validated environment configuration
├── types/index.ts                    # Domain models + Zod request/answer schemas
├── services/
│   ├── embedding.service.ts          # Dense embeddings (OpenAI + deterministic fallback)
│   ├── chunking.service.ts           # Parent/child hierarchical chunker
│   ├── parent-store.service.ts       # Parent chunk store (generation context)
│   ├── vector-store.service.ts       # Child chunk vector index (retrieval units)
│   ├── bm25.service.ts               # Sparse lexical retrieval over children
│   ├── result-merger.service.ts      # Dense + sparse fusion & dedup
│   ├── reranker.service.ts           # Cross-encoder proxy reranking (children)
│   ├── parent-resolver.service.ts    # Child → parent resolution, dedup, context budget
│   ├── llm.service.ts                # Grounded generation from parent context
│   ├── indexing.service.ts           # Ingestion orchestration (chunk → store → index)
│   ├── parent-document-rag.service.ts# Top-level search + RAG orchestrator
│   └── benchmark.service.ts          # Comparative Standard vs Parent-Document benchmark
├── controllers/parent-document.controller.ts
├── routes/parent-document.routes.ts
├── middlewares/{error,validation}.middleware.ts
├── app.ts        # Express app factory + sample-data bootstrapping
├── server.ts     # HTTP server entry point
├── cli.ts        # Interactive command-line interface
└── index.ts      # Public library exports
```

---

## 🧠 Key Mental Model

```text
              RETRIEVAL
                 │
                 ▼
        ┌─────────────────┐
        │  Small Child    │   ~350 chars  (~80 tokens)
        └────────┬────────┘
                 │  parentId
                 ▼
        ┌─────────────────┐
        │  Large Parent   │   ~1500 chars (~375 tokens)
        └────────┬────────┘
                 │
                 ▼
              GENERATION
                 │
                 ▼
                LLM
```

> **Child chunks are optimized for finding. Parent chunks are optimized for understanding.**
