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
