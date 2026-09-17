#!/usr/bin/env node
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { VectorRAGPipeline } from './pipeline/vectorRag';
import { VectorBenchmarkRunner } from './pipeline/benchmark';
import { IndexType, SimilarityMetric } from './schemas';

dotenv.config();

const program = new Command();

program
  .name('vector-rag')
  .description('Production-grade Vector RAG Engine CLI with HNSW & IVF ANN indexes')
  .version('1.0.0');

// Command 1: Ingest Documents
program
  .command('ingest')
  .description('Ingest documents or directory into the Vector RAG database')
  .requiredOption('-p, --path <path>', 'Path to file or directory to ingest')
  .option('-i, --index-type <type>', 'Vector index type (hnsw, flat, ivf)', 'hnsw')
  .option('-c, --chunk-size <size>', 'Chunk size in characters', '500')
  .option('-o, --overlap <size>', 'Chunk overlap in characters', '50')
  .action(async (options) => {
    try {
      console.log(`\n🚀 Initializing Vector RAG Engine (Index: ${options.indexType.toUpperCase()})...`);
      const targetPath = path.resolve(process.cwd(), options.path);

      const pipeline = new VectorRAGPipeline({
        indexType: options.indexType as IndexType,
        chunkSize: parseInt(options.chunkSize, 10),
        chunkOverlap: parseInt(options.overlap, 10),
        embeddingProvider: (process.env.RAG_EMBEDDING_PROVIDER as any) || 'mock',
        llmProvider: (process.env.RAG_LLM_PROVIDER as any) || 'mock',
      });

      console.log(`📥 Loading & Indexing documents from: ${targetPath}`);
      const stats = await pipeline.ingestPath(targetPath);

      console.log(`\n✅ Ingestion Complete!`);
      console.log(`   - Documents loaded: ${stats.numDocuments}`);
      console.log(`   - Chunks indexed:   ${stats.numChunks}`);
      console.log(`   - Total records:    ${pipeline.getVectorStore().count()}`);
    } catch (err: any) {
      console.error(`❌ Ingestion Error:`, err.message);
      process.exit(1);
    }
  });

// Command 2: Ask Question
program
  .command('ask')
  .description('Ask a question to the Vector RAG system')
  .requiredOption('-q, --question <question>', 'Question string to query')
  .option('-k, --top-k <k>', 'Number of top relevant context chunks to retrieve', '3')
  .option('-i, --index-type <type>', 'Index strategy (hnsw, flat, ivf)', 'hnsw')
  .option('-m, --metric <metric>', 'Similarity metric (cosine, dot_product, euclidean)', 'cosine')
  .action(async (options) => {
    try {
      const topK = parseInt(options.topK, 10);
      const indexType = options.indexType as IndexType;
      const metric = options.metric as SimilarityMetric;

      const pipeline = new VectorRAGPipeline({
        topK,
        indexType,
        similarityMetric: metric,
        embeddingProvider: (process.env.RAG_EMBEDDING_PROVIDER as any) || 'mock',
        llmProvider: (process.env.RAG_LLM_PROVIDER as any) || 'mock',
      });

      // Default sample knowledge ingestion if empty
      if (pipeline.getVectorStore().count() === 0) {
        console.log(`ℹ️ Vector store empty. Ingesting default vector RAG domain concepts...`);
        await pipeline.ingest(`
          Vector RAG converts text into dense numerical embeddings and performs Approximate Nearest Neighbor (ANN) search.
          Common ANN index algorithms include HNSW (Hierarchical Navigable Small World) and IVF (Inverted File Index).
          Cosine similarity measures the angle between vector embeddings, while Euclidean distance measures straight-line distance.
          Feline domestic cat care requires balanced nutrition, hydration, and regular veterinary checkups.
        `);
      }

      console.log(`\n🔍 Searching Vector DB (Index: ${indexType.toUpperCase()}, Metric: ${metric.toUpperCase()}, Top-K: ${topK})...`);
      const response = await pipeline.query(options.question, topK);

      console.log(`\n💡 QUESTION: ${response.question}`);
      console.log(`\n🤖 ANSWER:\n${response.answer}`);
      console.log(`\n📊 RETRIEVED CONTEXT CHUNKS (${response.contextChunks.length}):`);

      response.contextChunks.forEach((chunk, i) => {
        console.log(`\n  [Chunk ${i + 1}] Similarity Score: ${(chunk.score * 100).toFixed(2)}% | Dist: ${chunk.distance.toFixed(4)}`);
        console.log(`  Source: ${chunk.chunk.metadata.filename || chunk.chunk.metadata.source || 'inline'}`);
        console.log(`  Text: "${chunk.chunk.content.trim().substring(0, 150)}..."`);
      });

      console.log(`\n⏱️ LATENCY METRICS:`);
      console.log(`   - Retrieval Latency:  ${response.metadata.retrievalLatencyMs} ms`);
      console.log(`   - Generation Latency: ${response.metadata.generationLatencyMs} ms`);
      console.log(`   - Total Latency:      ${response.metadata.totalLatencyMs} ms`);
    } catch (err: any) {
      console.error(`❌ Query Error:`, err.message);
      process.exit(1);
    }
  });

// Command 3: Benchmark ANN Indexes
program
  .command('benchmark')
  .description('Run performance & recall benchmark comparing Flat vs HNSW vs IVF vector indexes')
  .option('-n, --size <size>', 'Dataset size (number of synthetic vector records)', '150')
  .option('-k, --top-k <k>', 'Top-K search results', '5')
  .action(async (options) => {
    try {
      const size = parseInt(options.size, 10);
      const topK = parseInt(options.topK, 10);

      console.log(`\n📊 Running Vector Search Benchmark (Dataset Size: ${size} records, Top-K: ${topK})...\n`);

      const results = await VectorBenchmarkRunner.runBenchmark(size, topK, 'cosine');

      console.table(
        results.map((r) => ({
          'Index Type': r.indexType.toUpperCase(),
          'Total Records': r.totalRecords,
          'Dimension': r.dimension,
          'Indexing Time (ms)': r.indexingTimeMs,
          'Query Latency (ms)': r.searchLatencyMs.toFixed(3),
          'Recall@K (%)': (r.recallAtK * 100).toFixed(1) + '%',
          'Avg Score': r.avgSimilarityScore.toFixed(4),
        }))
      );
    } catch (err: any) {
      console.error(`❌ Benchmark Error:`, err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
