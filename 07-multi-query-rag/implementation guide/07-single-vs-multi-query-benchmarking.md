# Chapter 7 — Single-Query vs Multi-Query Benchmarking

## 📊 Benchmark Metrics & Evaluation Methodology

Located in [`code/src/services/benchmark.service.ts`](../code/src/services/benchmark.service.ts), `BenchmarkService` executes a side-by-side comparison between Single-Query RAG and Multi-Query RAG.

### Key Metrics Evaluated:

1. **Single-Query Unique Chunks**: Number of distinct document chunks retrieved by a single search formulation.
2. **Multi-Query Unique Chunks**: Total unique deduplicated chunks retrieved across all generated query perspectives.
3. **Newly Discovered Chunks**: Chunks retrieved by Multi-Query RAG that Single-Query RAG completely missed:
   $$\text{New Chunks} = |\{ d \in \mathcal{C}_{\text{multi}} \setminus \mathcal{C}_{\text{single}} \}|$$
4. **Recall Gain Percentage**:
   $$\text{Recall Gain \%} = \frac{\text{New Chunks Discovered}}{|\mathcal{C}_{\text{single}}|} \times 100\%$$
5. **Deduplication Ratio**:
   $$\text{Deduplication Ratio} = \frac{\text{Unique Deduplicated Chunks}}{\text{Total Raw Retrieved Chunks}}$$

---

## 📈 Sample Benchmark Output

```text
====================================================
📈 BENCHMARK SUMMARY (4 Test Queries)
====================================================
Avg Single-Query Chunks Retrieved: 5
Avg Multi-Query Unique Chunks:     7
Avg New Chunks Discovered:        2
Avg Recall Gain Percentage:        +40%
Avg Deduplication Ratio:           0.297
Avg Single-Query Latency:          0.75 ms
Avg Multi-Query Latency:           1.25 ms
====================================================
```

In the final chapter, we will inspect the interactive CLI, sample dataset, and Jest testing suite.
