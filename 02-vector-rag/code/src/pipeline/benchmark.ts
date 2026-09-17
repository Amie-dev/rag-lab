import { VectorStore } from '../vectordb/vectorStore';
import { MockEmbeddingModel } from '../embeddings/mock';
import { BenchmarkResult, IndexType, SimilarityMetric, VectorRecord } from '../schemas';

export class VectorBenchmarkRunner {
  /**
   * Run benchmark comparing Flat, HNSW, and IVF index performance.
   */
  public static async runBenchmark(
    datasetSize: number = 100,
    topK: number = 5,
    metric: SimilarityMetric = 'cosine'
  ): Promise<BenchmarkResult[]> {
    const embedder = new MockEmbeddingModel(128);
    const records: VectorRecord[] = [];

    // Synthesize dataset of random vectors & chunks
    for (let i = 0; i < datasetSize; i++) {
      const text = `Document paragraph item ${i} containing semantic knowledge about artificial intelligence, vector database search, indexing performance, and HNSW graph node traversal ${i}.`;
      const vector = await embedder.embedQuery(text);

      records.push({
        id: `bench_rec_${i}`,
        vector,
        chunk: {
          id: `bench_chunk_${i}`,
          content: text,
          metadata: { documentId: `doc_${i}`, chunkIndex: i, source: 'benchmark_synthetic' },
        },
        metadata: { documentId: `doc_${i}`, chunkIndex: i, source: 'benchmark_synthetic' },
      });
    }

    // Generate query vectors
    const queries: number[][] = [];
    for (let q = 0; q < 5; q++) {
      queries.push(await embedder.embedQuery(`artificial intelligence vector index benchmark query ${q}`));
    }

    const indexTypes: IndexType[] = ['flat', 'hnsw', 'ivf'];
    const results: BenchmarkResult[] = [];

    // 1. Get ground truth results from Flat index
    const flatStore = new VectorStore({ indexConfig: { type: 'flat' } });
    await flatStore.addBatch(records);

    const groundTruth: string[][] = [];
    for (const queryVec of queries) {
      const res = await flatStore.search(queryVec, topK, metric);
      groundTruth.push(res.map((r) => r.recordId));
    }

    // 2. Benchmark each index strategy
    for (const idxType of indexTypes) {
      const store = new VectorStore({
        indexConfig: {
          type: idxType,
          hnsw: { M: 16, efConstruction: 64, efSearch: 32 },
          ivf: { numLists: 8, nprobe: 3 },
        },
      });

      // Measure indexing time
      const indexStart = Date.now();
      await store.addBatch(records);
      const indexingTimeMs = Date.now() - indexStart;

      // Measure search latency & recall
      let totalLatencyMs = 0;
      let recallSum = 0;
      let scoreSum = 0;
      let totalRetrieved = 0;

      for (let q = 0; q < queries.length; q++) {
        const qVec = queries[q];
        const searchStart = Date.now();
        const searchRes = await store.search(qVec, topK, metric);
        totalLatencyMs += Date.now() - searchStart;

        const retrievedIds = new Set(searchRes.map((r) => r.recordId));
        const truthIds = groundTruth[q];

        let matches = 0;
        for (const tId of truthIds) {
          if (retrievedIds.has(tId)) matches++;
        }

        const recall = truthIds.length > 0 ? matches / truthIds.length : 1.0;
        recallSum += recall;

        for (const r of searchRes) {
          scoreSum += r.score;
          totalRetrieved++;
        }
      }

      const avgSearchLatencyMs = totalLatencyMs / queries.length;
      const recallAtK = recallSum / queries.length;
      const avgSimilarityScore = totalRetrieved > 0 ? scoreSum / totalRetrieved : 0;

      results.push({
        indexType: idxType,
        totalRecords: datasetSize,
        dimension: embedder.dimension(),
        indexingTimeMs,
        searchLatencyMs: avgSearchLatencyMs,
        recallAtK,
        avgSimilarityScore,
      });
    }

    return results;
  }
}
