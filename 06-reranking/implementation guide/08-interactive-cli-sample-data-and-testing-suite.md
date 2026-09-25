# 💻 Chapter 8 — Interactive CLI, Sample Data & Testing Suite

Welcome to Chapter 8 of the **Reranking RAG Implementation Guide**. In this final chapter, we cover CLI execution via Commander, inspect the sample documentation dataset, and review Jest unit and integration tests.

All corresponding code is located in [`06-reranking/code`](../code).

---

## 1. Interactive CLI Tool (`src/cli.ts`)

The CLI provides four main commands:

```bash
# Command 1: Seed vector store with sample documentation
npx ts-node src/cli.ts seed

# Command 2: Execute Two-Stage Candidate Retrieval & Reranking Search
npx ts-node src/cli.ts search -q "How to reset account password" --candidate-top-n 20 --final-top-k 5

# Command 3: Execute Structured Output Grounded RAG Query
npx ts-node src/cli.ts query -q "What is our subscription refund policy?"

# Command 4: Run Quantitative Reranking Benchmark Suite
npx ts-node src/cli.ts benchmark
```

---

## 2. Sample Enterprise Dataset (`sample_data/documents.json`)

The dataset contains documents specifically structured to demonstrate bi-encoder vector similarity limitations vs cross-encoder accuracy:

```json
[
  {
    "id": "doc-auth-001",
    "content": "To reset your account password, open Settings -> Security -> Reset Password. Follow the email link sent to your registered email address to enter a new secure password.",
    "metadata": {
      "title": "Account Password Reset Procedure",
      "category": "authentication",
      "tags": ["security", "password", "reset"]
    }
  },
  {
    "id": "doc-auth-002",
    "content": "Users can change their account email address and profile notification preferences from the General Settings panel.",
    "metadata": {
      "title": "Changing Account Profile & Email Preferences",
      "category": "account",
      "tags": ["account", "email", "settings"]
    }
  },
  {
    "id": "doc-billing-001",
    "content": "Subscription Refund Policy: Customers are eligible for a full refund within 14 days of purchase if monthly software usage is below 100 API credits.",
    "metadata": {
      "title": "Subscription Billing & Refund Policy",
      "category": "billing",
      "tags": ["refund", "billing", "subscription"]
    }
  }
]
```

---

## 3. Comprehensive Jest Test Suite

The test suite covers unit and integration validation:

```bash
npm test
```

### Test Files Overview
1. `tests/bm25.service.test.ts`: Validates tokenization, term frequency, and BM25 IDF scoring.
2. `tests/reranker.service.test.ts`: Validates Cross-Encoder joint attention scoring and exact intent matching.
3. `tests/retrieval-pipeline.service.test.ts`: Validates end-to-end two-stage retrieval, candidate pool size $N$, top $K$, and rank movement calculation.
4. `tests/benchmark.service.test.ts`: Validates candidate size sweep and rank swap rate reporting.
5. `tests/api.test.ts`: Validates Express REST API endpoints via `supertest`.

```bash
Test Suites: 5 passed, 5 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        4.62 s
```

---

## 🏁 Conclusion

Congratulations! You have completed the **Reranking RAG Implementation Guide**. You now possess a production-ready, enterprise-grade understanding of Two-Stage Retrieval, Cross-Encoder Reranking, OpenAI SDK TypeScript Structured Outputs, REST APIs, and empirical benchmarking.
