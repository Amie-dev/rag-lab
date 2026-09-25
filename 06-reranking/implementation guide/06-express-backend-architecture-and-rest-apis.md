# 🌐 Chapter 6 — Express Backend Architecture & REST APIs

Welcome to Chapter 6 of the **Reranking RAG Implementation Guide**. In this chapter, we build the production Express HTTP server, register custom middleware, and define REST API routes.

All corresponding code is located in [`06-reranking/code`](../code).

---

## 1. Express Application Setup (`src/app.ts`)

```typescript
import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes';
import documentRoutes from './routes/document.routes';
import retrievalRoutes from './routes/retrieval.routes';
import ragRoutes from './routes/rag.routes';
import benchmarkRoutes from './routes/benchmark.routes';
import { requestLogger } from './middlewares/request-logger.middleware';
import { errorHandler } from './middlewares/error.middleware';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Register API Routes
app.use('/api/v1', healthRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1', retrievalRoutes);
app.use('/api/v1/rag', ragRoutes);
app.use('/api/v1/benchmark', benchmarkRoutes);

// Global Error Handler
app.use(errorHandler);
```

---

## 2. API Endpoints Reference

### 2.1 Ingest Document Chunk (`POST /api/v1/documents/ingest`)
Ingests a single document chunk into the vector store.

### 2.2 Seed Enterprise Dataset (`POST /api/v1/documents/seed`)
Loads `sample_data/documents.json` into the vector store.

### 2.3 Two-Stage Search (`POST /api/v1/search`)
Executes candidate retrieval (Stage 1) and Cross-Encoder reranking (Stage 2).

Request Body:
```json
{
  "query": "How to reset account password?",
  "stage1CandidateTopN": 20,
  "stage2FinalTopK": 5,
  "retrievalMode": "hybrid",
  "rerankerProvider": "local"
}
```

### 2.4 Direct Document Candidates Rerank (`POST /api/v1/rerank`)
Reranks an arbitrary list of candidate documents directly against a query.

### 2.5 Two-Stage RAG Query (`POST /api/v1/rag/query`)
Executes full retrieval, reranking, and grounded structured output generation.

### 2.6 Quantitative Benchmark Evaluation (`POST /api/v1/benchmark/evaluate`)
Runs rank swap rate and candidate pool size sweep benchmark report.

### 2.7 Health Check (`GET /api/v1/health`)
Returns service status, index counts, and provider configurations.

In Chapter 7, we build the Quantitative Reranking Evaluation & Benchmarking Suite.
