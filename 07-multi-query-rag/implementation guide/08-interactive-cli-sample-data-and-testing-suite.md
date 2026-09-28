# Chapter 8 — Interactive CLI, Sample Data & Testing Suite

## 🖥️ Interactive CLI Interface

Located in [`code/src/cli.ts`](../code/src/cli.ts), built with `commander`:

### Commands:

1. **Seed Dataset**:
   ```bash
   npx ts-node src/cli.ts seed
   ```
2. **Generate Query Variations**:
   ```bash
   npx ts-node src/cli.ts generate -q "How can I stop users from accessing protected pages after session expires?"
   ```
3. **Multi-Query Search & Fusion**:
   ```bash
   npx ts-node src/cli.ts search -q "How to reset account password" --num-queries 4 --fusion-strategy rrf
   ```
4. **Full Multi-Query RAG Execution**:
   ```bash
   npx ts-node src/cli.ts query -q "What is our subscription refund policy?"
   ```
5. **Run Comparative Benchmarks**:
   ```bash
   npx ts-node src/cli.ts compare
   ```

---

## 🧪 Jest Unit & Integration Test Suite

Located in [`code/tests/`](../code/tests/):

- `multi-query-generator.test.ts`: Verifies LLM structured query generation and local fallback perspective generation.
- `result-merger.test.ts`: Validates parallel retrieval merging, ID-based deduplication, attribution tracking, and RRF score fusion.
- `multi-query-rag.test.ts`: Tests end-to-end pipeline execution and grounded answer generation.
- `benchmark.test.ts`: Validates Single-Query vs Multi-Query comparative benchmark metrics calculations.
- `api.test.ts`: Full integration tests for Express HTTP endpoints using `supertest`.

Execute test suite:
```bash
npm test
```
