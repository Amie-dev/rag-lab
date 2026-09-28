# Chapter 6 — Express Backend Architecture & REST APIs

## 🌐 Server Setup

Located in [`code/src/app.ts`](../code/src/app.ts) and [`code/src/server.ts`](../code/src/server.ts), the Express server includes middleware for CORS, JSON request body parsing, request logging, and global error handling with Zod validation.

```typescript
export const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// API Routes
app.use('/api/v1', healthRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/multi-query', multiQueryRoutes);
app.use('/api/v1/rag', ragRoutes);
app.use('/api/v1/benchmark', benchmarkRoutes);

app.use(errorHandler);
```

---

## 📡 REST API Endpoints

### 1. Generate Query Variations
- **Endpoint**: `POST /api/v1/multi-query/generate`
- **Request Body**:
  ```json
  {
    "query": "How to handle session timeout?",
    "numQueries": 4
  }
  ```

### 2. Multi-Query Candidate Search & Fusion
- **Endpoint**: `POST /api/v1/multi-query/search`
- **Request Body**:
  ```json
  {
    "query": "How to handle session timeout?",
    "numQueries": 4,
    "topKPerQuery": 5,
    "fusionStrategy": "rrf"
  }
  ```

### 3. End-to-End Multi-Query RAG Query
- **Endpoint**: `POST /api/v1/rag/query`
- **Request Body**:
  ```json
  {
    "question": "What is our subscription refund policy?",
    "numQueries": 4
  }
  ```

### 4. Comparative Benchmark Evaluation
- **Endpoint**: `POST /api/v1/benchmark/compare`

In the next chapter, we will examine the Single-Query vs Multi-Query Benchmarking suite.
