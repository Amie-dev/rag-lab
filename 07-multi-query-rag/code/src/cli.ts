import { Command } from 'commander';
import { vectorStoreService } from './services/vector-store.service';
import { multiQueryGeneratorService } from './services/multi-query-generator.service';
import { multiQueryRAGService } from './services/multi-query-rag.service';
import { benchmarkService } from './services/benchmark.service';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .name('multi-query-rag')
  .description('CLI tool for Multi-Query RAG Engine evaluation, retrieval, and benchmarking')
  .version('1.0.0');

// Helper to seed sample dataset
const ensureSeeded = async () => {
  if (vectorStoreService.getChunkCount() === 0) {
    const samplePath = path.resolve(process.cwd(), 'sample_data/documents.json');
    if (fs.existsSync(samplePath)) {
      const raw = fs.readFileSync(samplePath, 'utf-8');
      const docs = JSON.parse(raw);
      await vectorStoreService.bulkIngestDocuments(docs);
      console.log(`[CLI Auto-Seed] Ingested ${docs.length} document chunks into vector database.`);
    }
  }
};

program
  .command('seed')
  .description('Ingest sample dataset into vector store')
  .action(async () => {
    const samplePath = path.resolve(process.cwd(), 'sample_data/documents.json');
    if (!fs.existsSync(samplePath)) {
      console.error('Error: sample_data/documents.json not found');
      process.exit(1);
    }
    const raw = fs.readFileSync(samplePath, 'utf-8');
    const docs = JSON.parse(raw);
    const ingested = await vectorStoreService.bulkIngestDocuments(docs);
    console.log(`✅ Successfully seeded ${ingested.length} document chunks into vector store.`);
  });

program
  .command('generate')
  .description('Generate semantically diverse search query variations for a given question')
  .requiredOption('-q, --question <text>', 'Original user question')
  .option('-n, --num-queries <number>', 'Number of query variations to generate', '4')
  .action(async (options) => {
    const count = parseInt(options.numQueries, 10);
    console.log(`\n🔍 Generating ${count} Query Variations for: "${options.question}"\n`);
    const variations = await multiQueryGeneratorService.generateQueryVariations(options.question, count);

    variations.forEach((v, idx) => {
      console.log(`  [${v.queryId}] ${v.text} (${v.perspective})`);
    });
    console.log('');
  });

program
  .command('search')
  .description('Perform multi-query retrieval, fusion, and deduplication')
  .requiredOption('-q, --question <text>', 'Original user question')
  .option('-n, --num-queries <number>', 'Number of query variations', '4')
  .option('-k, --top-k-per-query <number>', 'Top-K per query', '5')
  .option('-f, --final-top-k <number>', 'Final Top-K context count', '5')
  .option('-s, --fusion-strategy <type>', 'Fusion strategy (rrf | max_score | avg_score)', 'rrf')
  .action(async (options) => {
    await ensureSeeded();
    const result = await multiQueryRAGService.search({
      query: options.question,
      numQueries: parseInt(options.numQueries, 10),
      topKPerQuery: parseInt(options.topKPerQuery, 10),
      finalTopK: parseInt(options.finalTopK, 10),
      fusionStrategy: options.fusionStrategy as any,
      retrievalMode: 'hybrid',
    });

    console.log(`\n====================================================`);
    console.log(`🔎 Multi-Query Retrieval Results for: "${options.question}"`);
    console.log(`====================================================`);
    console.log(`Generated Queries Count: ${result.generatedQueries.length}`);
    console.log(`Total Candidates Retrieved (Raw): ${result.totalCandidatesRetrieved}`);
    console.log(`Unique Candidates (Deduplicated): ${result.uniqueCandidatesDeduplicated}`);
    console.log(`Fusion Strategy: ${result.fusionStrategy}`);
    console.log(`----------------------------------------------------\n`);

    console.log(`Top ${result.topContextChunks.length} Deduplicated Candidates:\n`);
    result.topContextChunks.forEach((item, idx) => {
      console.log(`[#${idx + 1}] ID: ${item.chunk.id} | Title: "${item.chunk.metadata.title || 'Untitled'}"`);
      console.log(`     Score: ${item.finalScore.toFixed(4)} | Retrieved by ${item.occurrences} queries: [${item.retrievedByQueries.join(', ')}]`);
      console.log(`     Snippet: ${item.chunk.content.slice(0, 120).replace(/\n/g, ' ')}...`);
      console.log(`----------------------------------------------------`);
    });
  });

program
  .command('query')
  .description('Run full end-to-end Multi-Query RAG pipeline')
  .requiredOption('-q, --question <text>', 'User question')
  .option('-n, --num-queries <number>', 'Number of query variations', '4')
  .action(async (options) => {
    await ensureSeeded();
    console.log(`\n🤖 Executing Multi-Query RAG for: "${options.question}"...\n`);
    const ragResponse = await multiQueryRAGService.executeRAG({
      question: options.question,
      numQueries: parseInt(options.numQueries, 10),
    });

    console.log(`====================================================`);
    console.log(`🎯 Multi-Query RAG Response`);
    console.log(`====================================================`);
    console.log(`Confidence Score: ${(ragResponse.confidenceScore * 100).toFixed(1)}%`);
    console.log(`Cited Chunk IDs: [${ragResponse.citedChunkIds.join(', ')}]`);
    console.log(`----------------------------------------------------`);
    console.log(`\n💬 ANSWER:\n${ragResponse.answer}\n`);
    console.log(`----------------------------------------------------`);
    console.log(`\n💡 KEY INSIGHTS:`);
    ragResponse.keyInsights.forEach((insight) => console.log(` - ${insight}`));
    console.log(`\n====================================================\n`);
  });

program
  .command('compare')
  .description('Run comparative benchmark suite (Single-Query RAG vs Multi-Query RAG)')
  .action(async () => {
    await ensureSeeded();
    console.log(`\n📊 Running Single-Query vs Multi-Query RAG Comparative Benchmarks...\n`);
    const benchmark = await benchmarkService.runBenchmark({});

    console.log(`====================================================`);
    console.log(`📈 BENCHMARK SUMMARY (${benchmark.testQueriesCount} Test Queries)`);
    console.log(`====================================================`);
    console.log(`Avg Single-Query Chunks Retrieved: ${benchmark.averageMetrics.avgSingleQueryChunks}`);
    console.log(`Avg Multi-Query Unique Chunks:     ${benchmark.averageMetrics.avgMultiQueryUniqueChunks}`);
    console.log(`Avg New Chunks Discovered:        ${benchmark.averageMetrics.avgNewChunksDiscovered}`);
    console.log(`Avg Recall Gain Percentage:        +${benchmark.averageMetrics.avgRecallGainPercent}%`);
    console.log(`Avg Deduplication Ratio:           ${benchmark.averageMetrics.avgDeduplicationRatio}`);
    console.log(`Avg Single-Query Latency:          ${benchmark.averageMetrics.avgSingleQueryLatencyMs} ms`);
    console.log(`Avg Multi-Query Latency:           ${benchmark.averageMetrics.avgMultiQueryLatencyMs} ms`);
    console.log(`====================================================\n`);

    benchmark.results.forEach((r, idx) => {
      console.log(`Query ${idx + 1}: "${r.query}"`);
      console.log(`  Single Query: ${r.singleQueryMetrics.chunksRetrieved} chunks (${r.singleQueryMetrics.latencyMs}ms)`);
      console.log(`  Multi Query:  ${r.multiQueryMetrics.uniqueChunkCount} unique chunks across ${r.multiQueryMetrics.generatedQueries.length} perspectives`);
      console.log(`  Recall Gain:  +${r.multiQueryMetrics.recallGainPercent}% (${r.multiQueryMetrics.newChunksDiscovered} newly discovered chunks)`);
      console.log(`----------------------------------------------------`);
    });
  });

program.parse(process.argv);
