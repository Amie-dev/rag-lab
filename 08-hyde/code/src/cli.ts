#!/usr/bin/env ts-node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { initializeSampleData } from './app';
import { config } from './config/environment';
import { benchmarkService } from './services/benchmark.service';
import { hydeGeneratorService } from './services/hyde-generator.service';
import { hydeRAGService } from './services/hyde-rag.service';
import { vectorStoreService } from './services/vector-store.service';
import { Document, DomainContext, FusionStrategy, RetrievalMode } from './types';

const program = new Command();

program
  .name('hyde-rag')
  .description('Production CLI for HyDE (Hypothetical Document Embeddings) RAG Engine')
  .version('1.0.0');

// 1. Ingest Command
program
  .command('ingest')
  .description('Ingest documents into the vector store index')
  .option('-f, --file <path>', 'Path to custom documents JSON file')
  .action(async (options) => {
    try {
      let docs: Document[];
      if (options.file) {
        const filePath = path.resolve(process.cwd(), options.file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        docs = JSON.parse(fileContent);
      } else {
        await initializeSampleData();
        console.log(`✅ Sample documents loaded successfully (${vectorStoreService.getChunks().length} chunks).`);
        return;
      }

      const chunkCount = await vectorStoreService.ingestDocuments(docs);
      console.log(`\n🎉 Ingested ${docs.length} documents generating ${chunkCount} vector chunks.`);
    } catch (error) {
      console.error('❌ Ingestion failed:', error);
      process.exit(1);
    }
  });

// 2. HyDE Generate Preview Command
program
  .command('hyde-generate <query>')
  .description('Generate hypothetical document passage preview for a given query')
  .option('-n, --num-docs <number>', 'Number of hypothetical documents to generate', '1')
  .option('-d, --domain <context>', 'Domain context (technical, general, legal, medical, financial)', 'technical')
  .action(async (query: string, options) => {
    try {
      const numDocs = parseInt(options.numDocs, 10);
      const domain = options.domain as DomainContext;

      console.log(`\n🔍 Generating ${numDocs} Hypothetical Document(s) [Domain: ${domain}] for: "${query}"...\n`);
      const docs = await hydeGeneratorService.generateHypotheticalDocuments(query, numDocs, domain);

      docs.forEach((doc, idx) => {
        console.log(`--- [Hypothetical Document #${idx + 1} | ID: ${doc.id}] ---`);
        console.log(doc.hypotheticalText);
        console.log('\n');
      });
    } catch (error) {
      console.error('❌ HyDE document generation failed:', error);
      process.exit(1);
    }
  });

// 3. Search Command
program
  .command('search <query>')
  .description('Perform HyDE retrieval across hypothetical documents and vector/hybrid index')
  .option('-n, --num-docs <number>', 'Number of hypothetical documents', '1')
  .option('-k, --top-k <number>', 'Final Top-K candidates to retrieve', '5')
  .option('-m, --mode <mode>', 'Retrieval mode (vector_only, hybrid)', 'hybrid')
  .option('-s, --strategy <strategy>', 'Fusion strategy (rrf, score_weighted, max_score)', 'rrf')
  .option('--no-rerank', 'Disable cross-encoder reranking')
  .action(async (query: string, options) => {
    try {
      await initializeSampleData();

      const searchResult = await hydeRAGService.search({
        query,
        numHypotheticalDocs: parseInt(options.numDocs, 10),
        finalTopK: parseInt(options.topK, 10),
        retrievalMode: options.mode as RetrievalMode,
        fusionStrategy: options.strategy as FusionStrategy,
        enableReranking: options.rerank !== false,
      });

      console.log(`\n🔎 HyDE Search Execution Summary (${searchResult.executionTimeMs} ms):`);
      console.log(`- Original Query: "${searchResult.originalQuery}"`);
      console.log(`- Total Retrieved Hits: ${searchResult.totalCandidatesRetrieved}`);
      console.log(`- Unique Deduplicated Chunks: ${searchResult.uniqueCandidatesDeduplicated}`);
      console.log(`- Fusion Strategy Applied: ${searchResult.fusionStrategy}`);

      console.log('\n--- 📚 Top Retrieved Context Chunks ---');
      searchResult.topContextChunks.forEach((c, idx) => {
        const title = c.chunk.metadata.title || 'Untitled';
        console.log(`\n[${idx + 1}] Chunk ID: ${c.chunk.id} | Score: ${c.finalScore} | Title: "${title}"`);
        console.log(`    Retrieved by methods: ${c.retrievedByMethods.join(', ')}`);
        console.log(`    Content: ${c.chunk.content}`);
      });
    } catch (error) {
      console.error('❌ Search execution failed:', error);
      process.exit(1);
    }
  });

// 4. Ask Command (End-to-End RAG)
program
  .command('ask <question>')
  .description('Run complete HyDE RAG pipeline to generate grounded answer')
  .option('-n, --num-docs <number>', 'Number of hypothetical documents', '1')
  .option('-k, --top-k <number>', 'Final Top-K context chunks', '5')
  .option('-d, --domain <context>', 'Domain context', 'technical')
  .action(async (question: string, options) => {
    try {
      await initializeSampleData();

      console.log(`\n⚡ Executing HyDE RAG Pipeline for: "${question}"...\n`);

      const ragResult = await hydeRAGService.executeRAG({
        question,
        numHypotheticalDocs: parseInt(options.numDocs, 10),
        finalTopK: parseInt(options.topK, 10),
        domainContext: options.domain as DomainContext,
      });

      console.log('--- 🤖 Grounded LLM Response ---');
      console.log(`Answer:\n${ragResult.answer}\n`);
      console.log(`Confidence Score: ${ragResult.confidenceScore}`);
      console.log(`Cited Document Chunk IDs: ${ragResult.citedChunkIds.join(', ') || 'None'}`);

      console.log('\n--- 💡 Key Evidence Insights ---');
      ragResult.keyInsights.forEach((insight) => console.log(`• ${insight}`));

      console.log(`\n⏱️ Total Execution Time: ${ragResult.executionTimeMs} ms`);
    } catch (error) {
      console.error('❌ HyDE RAG pipeline failed:', error);
      process.exit(1);
    }
  });

// 5. Benchmark Command
program
  .command('benchmark')
  .description('Run comparative retrieval benchmark across RAG pipeline strategies')
  .action(async () => {
    try {
      await initializeSampleData();
      console.log('\n📊 Running HyDE Comparative Retrieval Benchmark Suite...\n');

      const benchmarkResult = await benchmarkService.runBenchmark({});

      console.log(`Evaluated ${benchmarkResult.totalQueriesEvaluated} standard queries:\n`);
      console.table(
        Object.values(benchmarkResult.metricsPerStrategy).map((m) => ({
          Strategy: m.pipelineType,
          'Latency (ms)': m.latencyMs,
          'Candidates Retrieved': m.candidatesRetrieved,
          'Unique Chunks': m.uniqueDeduplicated,
          'Avg Sim Score': m.avgSimilarityScore,
          'Rep Gap Alignment': m.representationGapScore,
          'Answer Confidence': m.answerConfidence,
        }))
      );

      console.log('\n--- 📈 Benchmark Insights ---');
      console.log(`• Recommended Strategy: ${benchmarkResult.summary.recommendedStrategy}`);
      console.log(
        `• Representation Gap Alignment Improvement: +${benchmarkResult.summary.representationGapReductionPct}% over baseline`
      );
    } catch (error) {
      console.error('❌ Benchmark execution failed:', error);
      process.exit(1);
    }
  });

// 6. Server Command
program
  .command('server')
  .description('Start Express REST API server')
  .action(async () => {
    const { createApp } = await import('./app');
    const app = await createApp();
    app.listen(config.port, () => {
      console.log(`🚀 HyDE RAG REST API running on http://localhost:${config.port}/api/v1/hyde`);
    });
  });

program.parse(process.argv);
