# Chapter 10 — Interactive CLI & Unit Testing Suite

This chapter covers the interactive command-line interface (CLI) application and the Jest testing suite.

Source code locations:
- [`src/cli.ts`](../code/src/cli.ts)
- [`tests/`](../code/tests)

---

## 1. Interactive CLI Application

Built using `commander`, the CLI provides three main commands:

### A. Document Ingestion Command
Ingests documents from a file or folder path into the Vector RAG database:

```bash
npx ts-node src/cli.ts ingest --path sample_data/ --index-type hnsw
```

### B. Interactive Question Answering Command
Executes end-to-end vector search retrieval and context augmentation:

```bash
npx ts-node src/cli.ts ask --question "How do I take care of a domestic cat?" --top-k 3 --index-type hnsw
```

```text
💡 QUESTION: How do I take care of a domestic cat?

🤖 ANSWER:
Based on vector search context:
Feline domestic cat care requires high quality nutrition, clean water, and regular veterinary care...

📊 RETRIEVED CONTEXT CHUNKS (1):
  [Chunk 1] Similarity Score: 66.33% | Dist: 0.6733
  Source: sample_data/cat_care_guide.md

⏱️ LATENCY METRICS:
   - Retrieval Latency:  0 ms
   - Generation Latency: 1 ms
   - Total Latency:      1 ms
```

### C. ANN Benchmarking Command
Benchmarks `Flat`, `HNSW`, and `IVF` vector indexes:

```bash
npx ts-node src/cli.ts benchmark --size 150 --top-k 5
```

---

## 2. Automated Unit Testing Suite

The Jest testing suite covers vector math, HNSW graph search, IVF clustering, metadata payload filtering, and pipeline orchestration.

### Running Tests
```bash
npm test
```

### Test Output

```text
PASS tests/vectorMath.test.ts
PASS tests/hnsw.test.ts
PASS tests/vectorStore.test.ts
PASS tests/benchmark.test.ts
PASS tests/pipeline.test.ts

Test Suites: 5 passed, 5 total
Tests:       11 passed, 11 total
Snapshots:   0 total
Time:        4.351 s
Ran all test suites.
```
