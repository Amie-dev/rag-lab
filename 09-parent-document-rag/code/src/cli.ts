#!/usr/bin/env ts-node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { initializeSampleData } from './app';
import { config } from './config/environment';
import { benchmarkService } from './services/benchmark.service';
import { indexingService } from './services/indexing.service';
import { parentDocumentRAGService } from './services/parent-document-rag.service';
import { parentStoreService } from './services/parent-store.service';
import { vectorStoreService } from './services/vector-store.service';
import { Document } from './types';

const program = new Command();

program
  .name('parent-document-rag')
  .description('Production CLI for the Parent-Document RAG Engine')
  .version('1.0.0');

// 1. Ingest Command
program
  .command('ingest')
  .description('Ingest documents, building the parent/child hierarchy')
  .option('-f, --file <path>', 'Path to a custom documents JSON file')
  .action(async (options) => {
    try {
      let docs: Document[];
      if (options.file) {
        const filePath = path.resolve(process.cwd(), options.file);
        docs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } else {
        await initializeSampleData();
        console.log(
          `✅ Sample documents loaded (${parentStoreService.size()} parents, ${vectorStoreService.getChildren().length} children).`
        );
        return;
      }

      const stats = await indexingService.ingestDocuments(docs);
      console.log(
        `\n🎉 Ingested ${stats.documentsIngested} documents → ${stats.parentsCreated} parent chunks → ${stats.childrenCreated} child chunks.`
      );
    } catch (error) {
      console.error('❌ Ingestion failed:', error);
      process.exit(1);
    }
  });

// 2. Inspect Command
program
  .command('inspect')
  .description('Show the ingested parent/child hierarchy summary')
  .action(async () => {
    try {
      await initializeSampleData();

      const parents = parentStoreService.getAllParents();
      const children = vectorStoreService.getChildren();

      console.log(`\n📚 Knowledge Base Hierarchy`);
      console.log(`   Parents : ${parents.length}`);
      console.log(`   Children: ${children.length}\n`);

      console.table(
        parents.map((p) => ({
          'Parent ID': p.id,
          Title: p.metadata.title || 'Untitled',
          Children: p.childCount,
          '~Tokens': p.tokenEstimate,
        }))
      );
    } catch (error) {
      console.error('❌ Inspect failed:', error);
      process.exit(1);
    }
  });

// 3. Search Command
program
  .command('search <query>')
  .description('Retrieve child candidates and resolve them to parent contexts')
  .option('-k, --child-top-k <number>', 'Child candidates to retrieve', String(config.defaultChildTopK))
  .option('-p, --max-parents <number>', 'Maximum parent contexts to resolve', String(config.defaultMaxParents))
  .option('-t, --max-context-tokens <number>', 'Context token budget', String(config.defaultMaxContextTokens))
  .option('--no-rerank', 'Disable child reranking')
  .action(async (query: string, options) => {
    try {
      await initializeSampleData();

      console.log(`\n🔍 Parent-Document search for: "${query}"...\n`);

      const result = await parentDocumentRAGService.search({
        query,
        childTopK: parseInt(options.childTopK, 10),
        maxParents: parseInt(options.maxParents, 10),
        maxContextTokens: parseInt(options.maxContextTokens, 10),
        enableReranking: options.rerank,
      });

      console.log(
        `📦 Child candidates retrieved: ${result.totalChildCandidatesRetrieved} (${result.uniqueChildrenDeduplicated} unique)`
      );
      console.log(
        `🧩 Parent contexts resolved: ${result.resolution.parentContexts.length} of ${result.resolution.uniqueParentCount} unique parents (budget: ${result.resolution.totalContextTokens} tokens)\n`
      );

      result.resolution.parentContexts.forEach((ctx, idx) => {
        const title = ctx.parent.metadata.title || 'Untitled';
        console.log(
          `#${idx + 1} [Parent ${ctx.parent.id}] rank=${ctx.rankScore} best_child=${ctx.bestChildScore} children=${ctx.contributingChildCount} tokens=${ctx.tokenEstimate}`
        );
        console.log(`    Title: "${title}"`);
        console.log(`    Retrieved by: ${ctx.retrievedByMethods.join(', ')}`);
        console.log(`    Context: ${ctx.parent.content.slice(0, 220)}...\n`);
      });
    } catch (error) {
      console.error('❌ Search execution failed:', error);
      process.exit(1);
    }
  });

// 4. Ask Command (End-to-End RAG)
program
  .command('ask <question>')
  .description('Run the complete Parent-Document RAG pipeline to generate a grounded answer')
  .option('-k, --child-top-k <number>', 'Child candidates to retrieve', String(config.defaultChildTopK))
  .option('-p, --max-parents <number>', 'Maximum parent contexts', String(config.defaultMaxParents))
  .option('-t, --max-context-tokens <number>', 'Context token budget', String(config.defaultMaxContextTokens))
  .option('--no-rerank', 'Disable child reranking')
  .action(async (question: string, options) => {
    try {
      await initializeSampleData();

      console.log(`\n⚡ Executing Parent-Document RAG pipeline for: "${question}"...\n`);

      const result = await parentDocumentRAGService.executeRAG({
        question,
        childTopK: parseInt(options.childTopK, 10),
        maxParents: parseInt(options.maxParents, 10),
        maxContextTokens: parseInt(options.maxContextTokens, 10),
        enableReranking: options.rerank,
      });

      console.log('--- 🤖 Grounded LLM Response ---');
      console.log(`Answer:\n${result.answer}\n`);
      console.log(`Confidence Score: ${result.confidenceScore}`);
      console.log(`Cited Parent IDs: ${result.citedParentIds.join(', ') || 'None'}`);
      console.log(
        `\nRetrieval: ${result.retrievalSummary.totalChildCandidates} child candidates → ${result.retrievalSummary.parentContextsResolved} parent contexts (${result.retrievalSummary.totalContextTokens} tokens)`
      );

      console.log('\n--- 💡 Key Evidence Insights ---');
      result.keyInsights.forEach((insight) => console.log(`• ${insight}`));

      console.log(`\n⏱️ Total Execution Time: ${result.executionTimeMs} ms`);
    } catch (error) {
      console.error('❌ Parent-Document RAG pipeline failed:', error);
      process.exit(1);
    }
  });

// 5. Benchmark Command
program
  .command('benchmark')
  .description('Run the comparative Standard vs Parent-Document RAG benchmark suite')
  .action(async () => {
    try {
      await initializeSampleData();
      console.log('\n📊 Running Parent-Document RAG benchmark suite...\n');

      const result = await benchmarkService.runBenchmark({});

      console.log(`Evaluated ${result.totalQueriesEvaluated} standard queries:\n`);
      console.table(
        Object.values(result.metricsPerStrategy).map((m) => ({
          Strategy: m.pipelineType,
          'Latency (ms)': m.latencyMs,
          Children: m.childrenRetrieved,
          'Parents Resolved': m.parentContextsResolved,
          'Context Tokens': m.contextTokens,
          'Completeness': m.contextCompletenessScore,
          'Confidence': m.answerConfidence,
        }))
      );

      console.log('\n--- 📈 Benchmark Insights ---');
      console.log(`• Recommended Strategy: ${result.summary.recommendedStrategy}`);
      console.log(
        `• Context Completeness Gain: +${result.summary.contextCompletenessGainPct}% over the child-only baseline`
      );
    } catch (error) {
      console.error('❌ Benchmark execution failed:', error);
      process.exit(1);
    }
  });

// 6. Server Command
program
  .command('server')
  .description('Start the Express REST API server')
  .action(async () => {
    const { createApp } = await import('./app');
    const app = await createApp();
    app.listen(config.port, () => {
      console.log(
        `🚀 Parent-Document RAG REST API running on http://localhost:${config.port}/api/v1/parent-document`
      );
    });
  });

program.parse(process.argv);

