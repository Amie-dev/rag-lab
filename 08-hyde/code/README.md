# 08 — HyDE (Hypothetical Document Embeddings) RAG Engine

> **Production-grade HyDE (Hypothetical Document Embeddings) Engine** written in TypeScript with Express REST API, OpenAI SDK Structured Outputs, Cross-Encoder Reranking, Vector & BM25 Hybrid Retrieval, Comparative Benchmarks, and interactive CLI.

---

## 🏗️ Architecture Overview

HyDE solves the **representation gap** between short, interrogative user queries and long, declarative knowledge-base passages by introducing a synthetic generation bridge:

```text
User Question
      ↓
LLM (HyDE Generator)
      ↓
Hypothetical Passage (Synthetic Document)
      ↓
Embedding Model (Dense Vector Calculation)
      ↓
Vector Search + BM25 Sparse Search
      ↓
Candidate Merging & Fusion (RRF / Score-Weighted)
      ↓
Cross-Encoder Reranker
      ↓
Real Grounded Context Chunks
      ↓
Generation LLM (Structured Output Zod Validation)
      ↓
Final Grounded Answer
```

> ⚠️ **Key Architectural Principle**: The hypothetical document is used **strictly for retrieval**. It is NEVER supplied as trusted evidence for final LLM answer generation. Grounded generation relies exclusively on real retrieved knowledge-base chunks.

---

## 🛠️ Features

- **Domain-Tailored Synthetic Generator**: Supports technical, legal, medical, and financial domain prompts for HyDE passage generation.
- **Multi-HyDE & Single-HyDE**: Generate 1 to N hypothetical document perspectives to maximize vector coverage.
- **Hybrid Retrieval**: Combines dense vector similarity with BM25 sparse keyword matching.
- **Reciprocal Rank Fusion (RRF)**: Merges candidates across multiple hypothetical document retrieval passes without scale bias.
- **Cross-Encoder Reranker**: Reorders retrieved candidate chunks against original query context before LLM injection.
- **OpenAI Structured Outputs**: Uses `zodResponseFormat` for strict JSON answer schema validation.
- **Zero-Dependency Local Fallback Engine**: System operates out-of-the-box offline using local L2-normalized deterministic embedding hashing when `OPENAI_API_KEY` is omitted.
- **Interactive CLI**: Command-line tool for document ingestion, HyDE previews, retrieval execution, RAG answering, and comparative benchmarks.
- **Express REST API**: Clean controller, middleware, and route setup with request validation and global error handling.

---

## 🚀 Quick Start

### 1. Installation

```bash
cd 08-hyde/code
npm install
```

### 2. Environment Setup

Create `.env` (optional - system functions with local fallback if OpenAI key is omitted):

```bash
cp .env.example .env
```

```env
PORT=3000
NODE_ENV=development
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_COMPLETION_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### 3. Build & Test

```bash
# Compile TypeScript to dist/
npm run build

# Run Jest unit and integration test suite
npm run test
```

---

## 💻 CLI Usage

The CLI tool allows testing HyDE pipeline components directly from your shell:

```bash
# 1. Preview Hypothetical Document generation for a question
npx ts-node src/cli.ts hyde-generate "How does RAG reduce hallucinations?" --domain technical

# 2. Perform HyDE candidate search & retrieval
npx ts-node src/cli.ts search "How does vector search improve RAG?" --num-docs 1 --top-k 5

# 3. Execute End-to-End Grounded RAG Pipeline
npx ts-node src/cli.ts ask "How are expired user sessions invalidated in JWT authentication?"

# 4. Run Comparative Benchmarks across strategies
npx ts-node src/cli.ts benchmark

# 5. Ingest custom document JSON dataset
npx ts-node src/cli.ts ingest --file sample_data/documents.json
```

---

## 🌐 REST API Specification

Start Express server:

```bash
npm run start
# Server listens on http://localhost:3000/api/v1/hyde
```

### Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/hyde/health` | Health check & vector store status |
| `GET` | `/api/v1/hyde/documents` | List ingested document chunks summary |
| `POST` | `/api/v1/hyde/documents/ingest` | Bulk ingest custom document objects |
| `POST` | `/api/v1/hyde/generate-hypothetical` | Generate hypothetical document preview |
| `POST` | `/api/v1/hyde/search` | Execute HyDE retrieval & candidate fusion |
| `POST` | `/api/v1/hyde/rag` | Full end-to-end HyDE RAG answer synthesis |
| `POST` | `/api/v1/hyde/benchmark` | Run comparative strategy benchmark suite |

### Example Request (`POST /api/v1/hyde/rag`)

```json
{
  "question": "How does vector search improve RAG accuracy?",
  "numHypotheticalDocs": 1,
  "topKPerDoc": 5,
  "finalTopK": 5,
  "fusionStrategy": "rrf",
  "retrievalMode": "hybrid",
  "enableReranking": true,
  "domainContext": "technical"
}
```

---

## 📊 Comparative Benchmark Output

Run `npm run cli benchmark` to execute performance and retrieval accuracy evaluations comparing:
1. **Direct Vector RAG**
2. **Single HyDE RAG**
3. **Multi-HyDE RAG**
4. **HyDE + Reranker RAG**

Sample Output:

```text
┌──────────────────────┬──────────────┬──────────────────────┬───────────────┬────────────────┬────────────────────┬───────────────────┐
│ Strategy             │ Latency (ms) │ Candidates Retrieved │ Unique Chunks │ Avg Sim Score  │ Rep Gap Alignment  │ Answer Confidence │
├──────────────────────┼──────────────┼──────────────────────┼───────────────┼────────────────┼────────────────────┼───────────────────┤
│ Direct Vector RAG    │ 12           │ 5                    │ 5             │ 0.6124         │ 0.4500             │ 0.8200            │
│ Single HyDE RAG      │ 48           │ 5                    │ 5             │ 0.8412         │ 0.8120             │ 0.9100            │
│ Multi-HyDE RAG       │ 112          │ 15                   │ 7             │ 0.8850         │ 0.8650             │ 0.9400            │
│ HyDE + Reranker RAG  │ 62           │ 5                    │ 5             │ 0.9240         │ 0.8920             │ 0.9650            │
└──────────────────────┴──────────────┴──────────────────────┴───────────────┴────────────────┴────────────────────┴───────────────────┘

📈 Representation Gap Alignment Improvement: +98.2% over baseline
```
