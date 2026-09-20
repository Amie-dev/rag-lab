# 💻 Chapter 9 — Interactive CLI & Testing Suite

Welcome to Chapter 9 of the **Hybrid RAG Implementation Guide**. In this final chapter, we cover the complete source code for the **Interactive CLI Application** and the **Jest Test Suite**.

All code snippets in this chapter are taken directly from [`04-hybrid-rag/code`](../code).

---

## 1. Interactive CLI Tool (`src/cli.ts`)

File: [`04-hybrid-rag/code/src/cli.ts`](../code/src/cli.ts)

```typescript
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { HybridRAGPipeline } from './pipeline/hybrid-pipeline';
import { FileLoader } from './loaders/file-loader';
import { FusionExplainer } from './fusion/explainer';
import { HybridBenchmarkRunner } from './analysis/benchmark';
import { FusionStrategy, ScoreNormalizerType } from './schemas';

dotenv.config();

const program = new Command();
program
  .name('hybrid-rag')
  .description('Production-grade Hybrid RAG engine with Dense, BM25 & RRF fusion')
  .version('1.0.0');

const defaultSamplePath = path.resolve(__dirname, '../sample_data/technical_docs.md');

async function getInitializedPipeline(
  dataPath?: string,
  useOpenAI: boolean = false
): Promise<HybridRAGPipeline> {
  const pipeline = new HybridRAGPipeline({ useOpenAI });
  const targetPath = dataPath || defaultSamplePath;

  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    let docs = [];
    if (stat.isDirectory()) {
      docs = FileLoader.loadDirectory(targetPath);
    } else {
      docs = [FileLoader.loadFile(targetPath)];
    }
    await pipeline.indexDocuments(docs);
  } else {
    console.warn(`[CLI Warning] Target path non-existent: ${targetPath}`);
  }

  return pipeline;
}

program
  .command('index')
  .description('Index a file or directory of documents into Dense and Sparse indexes')
  .argument('<path>', 'File or directory path to index')
  .action(async (targetPath: string) => {
    try {
      console.log(`\n📂 Indexing target: ${targetPath}...`);
      const pipeline = new HybridRAGPipeline();
      const stat = fs.statSync(targetPath);
      let docs = [];
      if (stat.isDirectory()) {
        docs = FileLoader.loadDirectory(targetPath);
      } else {
        docs = [FileLoader.loadFile(targetPath)];
      }

      const totalChunks = await pipeline.indexDocuments(docs);
      console.log(`✅ Indexing completed successfully!`);
      console.log(`   • Documents indexed: ${docs.length}`);
      console.log(`   • Chunks generated : ${totalChunks}`);
    } catch (error) {
      console.error(`❌ Indexing failed:`, error);
    }
  });

program
  .command('search')
  .description('Perform Hybrid RAG retrieval for a query')
  .argument('<query>', 'Search query string')
  .option('-d, --data <path>', 'Custom document path to index')
  .option('-k, --top-k <number>', 'Number of final top candidates to return', '5')
  .option('-s, --strategy <strategy>', 'Fusion strategy: rrf | weighted_score | weighted_rrf', 'rrf')
  .option('-a, --alpha <number>', 'Weight for dense search [0..1]', '0.5')
  .option('-r, --rrf-k <number>', 'RRF smoothing constant k', '60')
  .action(async (query: string, options: any) => {
    try {
      const pipeline = await getInitializedPipeline(options.data);
      const results = await pipeline.search(query, {
        topK: parseInt(options.topK, 10),
        fusionStrategy: options.strategy as FusionStrategy,
        alpha: parseFloat(options.alpha),
        rrfK: parseInt(options.rrfK, 10)
      });

      console.log(`\n🔍 Hybrid Search Results for: "${query}"`);
      console.log(`Strategy: ${options.strategy.toUpperCase()} | Top-K: ${options.topK}\n`);

      results.forEach((res, i) => {
        console.log(`--- [ Candidate #${i + 1} ] --- (Score: ${res.finalScore.toFixed(6)})`);
        console.log(`Chunk ID: ${res.chunk.id}`);
        console.log(`Content : "${res.chunk.content.slice(0, 150).replace(/\n/g, ' ')}..."\n`);
      });
    } catch (error) {
      console.error(`❌ Search failed:`, error);
    }
  });

program
  .command('explain')
  .description('Display detailed mathematical breakdown of rank & score fusion for a query')
  .argument('<query>', 'Search query string')
  .option('-d, --data <path>', 'Custom document path to index')
  .option('-k, --top-k <number>', 'Number of final top candidates', '3')
  .option('-s, --strategy <strategy>', 'Fusion strategy: rrf | weighted_score | weighted_rrf', 'rrf')
  .action(async (query: string, options: any) => {
    try {
      const pipeline = await getInitializedPipeline(options.data);
      const results = await pipeline.search(query, {
        topK: parseInt(options.topK, 10),
        fusionStrategy: options.strategy as FusionStrategy
      });

      console.log(`\n🧮 Fusion Mathematical Audit for: "${query}"\n`);
      console.log(FusionExplainer.formatAll(results));
    } catch (error) {
      console.error(`❌ Explanation failed:`, error);
    }
  });

program
  .command('ask')
  .description('Run complete Hybrid RAG pipeline and generate answer using LLM')
  .argument('<query>', 'Question to answer')
  .option('-d, --data <path>', 'Custom document path to index')
  .option('-k, --top-k <number>', 'Number of context chunks', '3')
  .option('-o, --openai', 'Use OpenAI API for embeddings and LLM generation', false)
  .action(async (query: string, options: any) => {
    try {
      console.log(`\n🤖 Processing Hybrid RAG Question: "${query}"...`);
      const pipeline = await getInitializedPipeline(options.data, options.openai);
      const response = await pipeline.answer(query, {
        topK: parseInt(options.topK, 10)
      });

      console.log(`\n=============================================================`);
      console.log(` ANSWER`);
      console.log(`=============================================================`);
      console.log(response.answer);
      console.log(`=============================================================`);
      console.log(` METADATA & LATENCY`);
      console.log(`   • Model Used        : ${response.metadata.model}`);
      console.log(`   • Total Chunks      : ${response.metadata.totalChunksIndexed}`);
      console.log(`   • Retrieval Latency : ${response.metadata.retrievalLatencyMs} ms`);
      console.log(`   • Generation Latency: ${response.metadata.generationLatencyMs} ms`);
      console.log(`   • Total Latency     : ${response.metadata.totalLatencyMs} ms`);
      console.log(`=============================================================\n`);
    } catch (error) {
      console.error(`❌ QA execution failed:`, error);
    }
  });

program
  .command('benchmark')
  .description('Run comparative performance benchmark across Dense vs Sparse vs Hybrid RAG')
  .argument('[path]', 'Custom document path to benchmark against')
  .option('-q, --query <query>', 'Benchmark query', 'How do I resolve ERR_CONNECTION_TIMED_OUT in React?')
  .action(async (targetPath: string | undefined, options: any) => {
    try {
      const pipeline = await getInitializedPipeline(targetPath);
      const runner = new HybridBenchmarkRunner(pipeline);
      const result = await runner.runQueryBenchmark(options.query, { topK: 5 });

      console.log('\n' + HybridBenchmarkRunner.formatBenchmarkReport(result) + '\n');
    } catch (error) {
      console.error(`❌ Benchmark failed:`, error);
    }
  });

program.parse(process.argv);
```

---

## 2. Complete Jest Test Suite Code (`tests/`)

### A. Fusion Tests (`tests/fusion.test.ts`)

File: [`04-hybrid-rag/code/tests/fusion.test.ts`](../code/tests/fusion.test.ts)

```typescript
import { ReciprocalRankFusion } from '../src/fusion/rrf';
import { WeightedScoreFusion, WeightedRRF } from '../src/fusion/weighted-fusion';
import { ScoreNormalizer } from '../src/fusion/normalizer';
import { FusionExplainer } from '../src/fusion/explainer';
import { DenseRetrievalResult, SparseRetrievalResult, Chunk } from '../src/schemas';

describe('Rank & Score Fusion Subsystem', () => {
  const dummyChunkA: Chunk = {
    id: 'chunk_A',
    content: 'Document A content about network connection timeouts',
    metadata: { documentId: 'doc_A', chunkIndex: 0, source: 'test' }
  };

  const dummyChunkB: Chunk = {
    id: 'chunk_B',
    content: 'Document B content about React performance hooks',
    metadata: { documentId: 'doc_B', chunkIndex: 0, source: 'test' }
  };

  const dummyChunkC: Chunk = {
    id: 'chunk_C',
    content: 'Document C content containing ERR_CONNECTION_TIMED_OUT',
    metadata: { documentId: 'doc_C', chunkIndex: 0, source: 'test' }
  };

  const denseResults: DenseRetrievalResult[] = [
    { recordId: 'chunk_A', chunk: dummyChunkA, score: 0.92, distance: 0.08, metric: 'cosine', rank: 1 },
    { recordId: 'chunk_B', chunk: dummyChunkB, score: 0.85, distance: 0.15, metric: 'cosine', rank: 2 },
    { recordId: 'chunk_C', chunk: dummyChunkC, score: 0.70, distance: 0.30, metric: 'cosine', rank: 3 }
  ];

  const sparseResults: SparseRetrievalResult[] = [
    { docId: 'doc_C', chunk: dummyChunkC, score: 12.5, matchedTerms: ['err_connection_timed_out'], rank: 1 },
    { docId: 'doc_A', chunk: dummyChunkA, score: 8.2, matchedTerms: ['network'], rank: 2 }
  ];

  describe('Reciprocal Rank Fusion (RRF)', () => {
    it('should calculate correct RRF scores with default k=60', () => {
      const rrf = new ReciprocalRankFusion({ k: 60 });
      const merged = rrf.fuse(denseResults, sparseResults, 3);

      expect(merged).toHaveLength(3);

      const chunkA = merged.find((r) => r.chunk.id === 'chunk_A')!;
      const chunkC = merged.find((r) => r.chunk.id === 'chunk_C')!;

      expect(chunkA.finalScore).toBeCloseTo(1 / 61 + 1 / 62, 5);
      expect(chunkC.finalScore).toBeCloseTo(1 / 63 + 1 / 61, 5);
      expect(merged[0].chunk.id).toBe('chunk_A');
      expect(merged[1].chunk.id).toBe('chunk_C');
    });

    it('should respect custom k parameter', () => {
      const rrf = new ReciprocalRankFusion({ k: 10 });
      const merged = rrf.fuse(denseResults, sparseResults, 3);
      const chunkA = merged.find((r) => r.chunk.id === 'chunk_A')!;

      expect(chunkA.finalScore).toBeCloseTo(1 / 11 + 1 / 12, 5);
    });
  });

  describe('Score Normalizers', () => {
    const items = [
      { id: '1', score: 10 },
      { id: '2', score: 20 },
      { id: '3', score: 30 }
    ];

    it('should normalize scores using MinMax', () => {
      const normMap = ScoreNormalizer.normalize(items, 'minmax');
      expect(normMap.get('1')).toBe(0.0);
      expect(normMap.get('2')).toBe(0.5);
      expect(normMap.get('3')).toBe(1.0);
    });

    it('should normalize scores using ZScore with Sigmoid', () => {
      const normMap = ScoreNormalizer.normalize(items, 'zscore');
      expect(normMap.get('2')).toBeCloseTo(0.5, 2);
      expect(normMap.get('3')!).toBeGreaterThan(0.5);
      expect(normMap.get('1')!).toBeLessThan(0.5);
    });

    it('should normalize scores using Softmax', () => {
      const normMap = ScoreNormalizer.normalize(items, 'softmax');
      let sum = 0;
      for (const val of normMap.values()) {
        sum += val;
      }
      expect(sum).toBeCloseTo(1.0, 5);
      expect(normMap.get('3')!).toBeGreaterThan(normMap.get('1')!);
    });
  });

  describe('Weighted Score Fusion', () => {
    it('should merge dense and sparse using alpha weighting', () => {
      const fusion = new WeightedScoreFusion({ alpha: 0.7, normalizerType: 'minmax' });
      const merged = fusion.fuse(denseResults, sparseResults, 3);

      expect(merged).toHaveLength(3);
      expect(merged[0].explanation.strategyUsed).toBe('weighted_score');
    });
  });

  describe('Weighted RRF', () => {
    it('should apply weights to RRF reciprocal terms', () => {
      const fusion = new WeightedRRF({ alpha: 0.8, rrfK: 60 });
      const merged = fusion.fuse(denseResults, sparseResults, 3);

      expect(merged).toHaveLength(3);
      expect(merged[0].explanation.strategyUsed).toBe('weighted_rrf');
    });
  });

  describe('Fusion Explainer', () => {
    it('should generate human-readable mathematical audit strings', () => {
      const rrf = new ReciprocalRankFusion({ k: 60 });
      const merged = rrf.fuse(denseResults, sparseResults, 2);
      const text = FusionExplainer.formatAll(merged);

      expect(text).toContain('Rank #1');
      expect(text).toContain('Strategy: RRF');
      expect(text).toContain('Dense Vector Search');
      expect(text).toContain('Sparse BM25 Search');
    });
  });
});
```

---

### B. Dense Subsystem Tests (`tests/dense.test.ts`)

File: [`04-hybrid-rag/code/tests/dense.test.ts`](../code/tests/dense.test.ts)

```typescript
import { computeCosineSimilarity, computeDotProduct, computeEuclideanDistance } from '../src/dense/metrics';
import { FlatVectorIndex } from '../src/dense/indexes/flat-index';
import { HNSWVectorIndex } from '../src/dense/indexes/hnsw-index';
import { IVFVectorIndex } from '../src/dense/indexes/ivf-index';
import { VectorStore } from '../src/dense/vector-store';
import { MockEmbeddingModel } from '../src/embeddings/mock-embeddings';
import { VectorRecord, Chunk } from '../src/schemas';

describe('Dense Subsystem', () => {
  describe('Metrics Math', () => {
    it('should compute exact cosine similarity for identical and orthogonal vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [1, 0, 0];
      const v3 = [0, 1, 0];

      expect(computeCosineSimilarity(v1, v2)).toBeCloseTo(1.0, 5);
      expect(computeCosineSimilarity(v1, v3)).toBeCloseTo(0.0, 5);
    });

    it('should compute dot product and euclidean distance correctly', () => {
      const v1 = [3, 4];
      const v2 = [0, 0];

      expect(computeDotProduct(v1, [1, 2])).toBe(11);
      expect(computeEuclideanDistance(v1, v2)).toBe(5);
    });
  });

  describe('Vector Indexes (Flat, HNSW, IVF)', () => {
    const records: VectorRecord[] = [
      {
        id: 'rec_1',
        vector: [1, 0, 0, 0],
        chunk: { id: 'c1', content: 'c1', metadata: { documentId: 'd1', chunkIndex: 0, source: 't' } },
        metadata: { documentId: 'd1', chunkIndex: 0, source: 't' }
      },
      {
        id: 'rec_2',
        vector: [0, 1, 0, 0],
        chunk: { id: 'c2', content: 'c2', metadata: { documentId: 'd2', chunkIndex: 0, source: 't' } },
        metadata: { documentId: 'd2', chunkIndex: 0, source: 't' }
      },
      {
        id: 'rec_3',
        vector: [0.9, 0.1, 0, 0],
        chunk: { id: 'c3', content: 'c3', metadata: { documentId: 'd3', chunkIndex: 0, source: 't' } },
        metadata: { documentId: 'd3', chunkIndex: 0, source: 't' }
      }
    ];

    it('should rank items accurately in Flat index', () => {
      const index = new FlatVectorIndex('cosine');
      index.addBatch(records);

      const query = [1, 0, 0, 0];
      const results = index.search(query, 2);

      expect(results).toHaveLength(2);
      expect(results[0].recordId).toBe('rec_1');
      expect(results[1].recordId).toBe('rec_3');
    });

    it('should index and retrieve items in HNSW index', () => {
      const index = new HNSWVectorIndex('cosine');
      index.addBatch(records);

      const query = [1, 0, 0, 0];
      const results = index.search(query, 2);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].recordId).toBe('rec_1');
    });

    it('should cluster and retrieve items in IVF index', () => {
      const index = new IVFVectorIndex('cosine', { numLists: 2, nprobe: 2 });
      index.addBatch(records);

      const query = [1, 0, 0, 0];
      const results = index.search(query, 2);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('VectorStore Wrapper', () => {
    it('should store chunks and query vectors', async () => {
      const store = new VectorStore(new MockEmbeddingModel());
      const chunks: Chunk[] = [
        { id: 'c1', content: 'React rendering hooks', metadata: { documentId: 'd1', chunkIndex: 0, source: 't' } },
        { id: 'c2', content: 'Network timeout errors', metadata: { documentId: 'd2', chunkIndex: 0, source: 't' } }
      ];

      await store.addChunks(chunks);
      expect(store.size()).toBe(2);

      const results = await store.search('React hooks', 1);
      expect(results).toHaveLength(1);
      expect(results[0].chunk.id).toBeDefined();
    });
  });
});
```

---

### C. Sparse Subsystem Tests (`tests/sparse.test.ts`)

File: [`04-hybrid-rag/code/tests/sparse.test.ts`](../code/tests/sparse.test.ts)

```typescript
import { TechnicalTextAnalyzer } from '../src/sparse/analyzer';
import { InvertedIndex } from '../src/sparse/inverted-index';
import { BM25Engine } from '../src/sparse/bm25';
import { Chunk } from '../src/schemas';

describe('Sparse Lexical Subsystem', () => {
  describe('TechnicalTextAnalyzer', () => {
    it('should preserve technical error codes, hex codes, and function signatures', () => {
      const analyzer = new TechnicalTextAnalyzer();
      const text = 'Encountered ERR_CONNECTION_TIMED_OUT and 0x80004005 in createPaymentIntent with SKU TX-9021-B.';

      const tokens = analyzer.tokenize(text);
      const terms = tokens.map((t) => t.term);

      expect(terms).toContain('err_connection_timed_out');
      expect(terms).toContain('0x80004005');
      expect(terms).toContain('createpaymentintent');
      expect(terms).toContain('tx-9021-b');
    });

    it('should filter standard stop words while keeping technical terms', () => {
      const analyzer = new TechnicalTextAnalyzer();
      const text = 'The system is in an error state with ERR_CONNECTION_TIMED_OUT.';

      const terms = analyzer.extractTerms(text);
      expect(terms).not.toContain('the');
      expect(terms).not.toContain('is');
      expect(terms).not.toContain('in');
      expect(terms).toContain('err_connection_timed_out');
    });
  });

  describe('Inverted Index & BM25 Scoring', () => {
    const chunks: Chunk[] = [
      {
        id: 'chunk_1',
        content: 'Troubleshooting guide for ERR_CONNECTION_TIMED_OUT when NGINX returns 504 Gateway Timeout.',
        metadata: { documentId: 'doc_1', chunkIndex: 0, source: 'test' }
      },
      {
        id: 'chunk_2',
        content: 'Stripe API reference guide for createPaymentIntent function and payment gateway integration.',
        metadata: { documentId: 'doc_2', chunkIndex: 0, source: 'test' }
      },
      {
        id: 'chunk_3',
        content: 'React performance optimization using useMemo and useEffect hooks for rendering.',
        metadata: { documentId: 'doc_3', chunkIndex: 0, source: 'test' }
      }
    ];

    it('should build postings list and compute correct document statistics', () => {
      const index = new InvertedIndex();
      index.addChunks(chunks);

      const stats = index.getStats();
      expect(stats.totalDocuments).toBe(3);
      expect(stats.vocabularySize).toBeGreaterThan(5);
      expect(index.getDocFrequency('err_connection_timed_out')).toBe(1);
    });

    it('should score and retrieve exact matching chunk using BM25', () => {
      const index = new InvertedIndex();
      index.addChunks(chunks);
      const bm25 = new BM25Engine(index);

      const results = bm25.search('ERR_CONNECTION_TIMED_OUT', 1);

      expect(results).toHaveLength(1);
      expect(results[0].chunk.id).toBe('chunk_1');
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].matchedTerms).toContain('err_connection_timed_out');
    });
  });
});
```

---

### D. Pipeline Integration Tests (`tests/pipeline.test.ts`)

File: [`04-hybrid-rag/code/tests/pipeline.test.ts`](../code/tests/pipeline.test.ts)

```typescript
import { HybridRAGPipeline } from '../src/pipeline/hybrid-pipeline';
import { Document } from '../src/schemas';

describe('Hybrid RAG Pipeline Integration', () => {
  const documents: Document[] = [
    {
      id: 'doc_tech',
      content:
        '# Technical Guide\n\n## Section 1\nError Code ERR_CONNECTION_TIMED_OUT occurs when network security rules block TCP port 443.',
      metadata: { source: 'tech.md', filename: 'tech.md' }
    },
    {
      id: 'doc_react',
      content:
        '# React Performance\n\n## Section 2\nUse useMemo hook to memoize expensive computations and maintain high FPS rendering.',
      metadata: { source: 'react.md', filename: 'react.md' }
    }
  ];

  it('should index documents into both Dense and Sparse indexes', async () => {
    const pipeline = new HybridRAGPipeline();
    const count = await pipeline.indexDocuments(documents);

    expect(count).toBeGreaterThan(0);
    expect(pipeline.size()).toBe(count);
  });

  it('should perform hybrid search and combine candidates using RRF', async () => {
    const pipeline = new HybridRAGPipeline();
    await pipeline.indexDocuments(documents);

    const results = await pipeline.search('ERR_CONNECTION_TIMED_OUT in network', {
      topK: 2,
      fusionStrategy: 'rrf'
    });

    expect(results).toHaveLength(2);
    expect(results[0].explanation.strategyUsed).toBe('rrf');
    expect(results[0].finalScore).toBeGreaterThan(0);
  });

  it('should generate complete RAG response with metadata and latency', async () => {
    const pipeline = new HybridRAGPipeline();
    await pipeline.indexDocuments(documents);

    const response = await pipeline.answer('How to resolve ERR_CONNECTION_TIMED_OUT?', { topK: 1 });

    expect(response.question).toBe('How to resolve ERR_CONNECTION_TIMED_OUT?');
    expect(response.answer).toBeDefined();
    expect(response.contextChunks).toHaveLength(1);
    expect(response.metadata.retrievalLatencyMs).toBeGreaterThanOrEqual(0);
    expect(response.metadata.generationLatencyMs).toBeGreaterThanOrEqual(0);
  });
});
```

---

### E. Benchmark & Rank Correlation Tests (`tests/benchmark.test.ts`)

File: [`04-hybrid-rag/code/tests/benchmark.test.ts`](../code/tests/benchmark.test.ts)

```typescript
import { RankCorrelationAnalyzer } from '../src/analysis/rank-correlation';
import { HybridBenchmarkRunner } from '../src/analysis/benchmark';
import { HybridRAGPipeline } from '../src/pipeline/hybrid-pipeline';
import { Document } from '../src/schemas';

describe('Benchmarking & Analytics Subsystem', () => {
  describe('Rank Correlation Analyzer', () => {
    it('should compute Kendall Tau and Spearman Rho for overlapping candidate lists', () => {
      const denseIds = ['chunk_1', 'chunk_2', 'chunk_3', 'chunk_4'];
      const sparseIds = ['chunk_2', 'chunk_1', 'chunk_4', 'chunk_5'];

      const result = RankCorrelationAnalyzer.analyze(denseIds, sparseIds);

      expect(result.commonItemCount).toBe(3);
      expect(result.jaccardSimilarity).toBeCloseTo(3 / 5, 2);
      expect(result.kendallTau).toBeDefined();
      expect(result.spearmanRho).toBeDefined();
    });

    it('should handle disjoint candidate lists without errors', () => {
      const denseIds = ['chunk_1', 'chunk_2'];
      const sparseIds = ['chunk_3', 'chunk_4'];

      const result = RankCorrelationAnalyzer.analyze(denseIds, sparseIds);

      expect(result.commonItemCount).toBe(0);
      expect(result.jaccardSimilarity).toBe(0);
      expect(result.kendallTau).toBe(0);
      expect(result.spearmanRho).toBe(0);
    });
  });

  describe('HybridBenchmarkRunner', () => {
    const docs: Document[] = [
      {
        id: 'doc_1',
        content: 'Network firewall port forwarding rules for ERR_CONNECTION_TIMED_OUT.',
        metadata: { source: 'sample' }
      },
      {
        id: 'doc_2',
        content: 'React component rendering optimization with useMemo hook.',
        metadata: { source: 'sample' }
      }
    ];

    it('should run comparative query benchmark across Dense, Sparse, and Hybrid', async () => {
      const pipeline = new HybridRAGPipeline();
      await pipeline.indexDocuments(docs);

      const runner = new HybridBenchmarkRunner(pipeline);
      const res = await runner.runQueryBenchmark('ERR_CONNECTION_TIMED_OUT', { topK: 2 });

      expect(res.query).toBe('ERR_CONNECTION_TIMED_OUT');
      expect(res.denseMetrics.candidateCount).toBeGreaterThan(0);
      expect(res.sparseMetrics.candidateCount).toBeGreaterThan(0);
      expect(res.hybridMetrics.candidateCount).toBeGreaterThan(0);

      const report = HybridBenchmarkRunner.formatBenchmarkReport(res);
      expect(report).toContain('HYBRID RAG COMPARATIVE BENCHMARK REPORT');
    });
  });
});
```

---

## 3. Execution & Verification Instructions

### Run Build & Test Suite

```bash
cd 04-hybrid-rag/code

# Compile TypeScript output
npm run build

# Run Jest unit test suite
npm test
```

### CLI Command Execution

```bash
# Index sample technical documentation
npx ts-node src/cli.ts index sample_data/technical_docs.md

# Search hybrid candidates with RRF fusion
npx ts-node src/cli.ts search "ERR_CONNECTION_TIMED_OUT in React" --top-k 5

# Display mathematical score audit
npx ts-node src/cli.ts explain "How to fix connection timeout?"

# Run QA pipeline
npx ts-node src/cli.ts ask "What causes ERR_CONNECTION_TIMED_OUT?"

# Execute performance benchmark
npx ts-node src/cli.ts benchmark sample_data/technical_docs.md
```

---

## 🎉 Guide Conclusion

You have completed the **Hybrid RAG Implementation Guide**! Every concept, mathematical formula, function, data structure, and test suite is fully implemented in TypeScript inside [`04-hybrid-rag/code`](../code). You now possess a production-ready Hybrid RAG engine combining Dense Vector Search, Sparse BM25 Search, and Reciprocal Rank Fusion.
