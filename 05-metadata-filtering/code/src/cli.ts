/**
 * CLI Tool for Metadata-Filtered RAG Engine
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { RAGService } from './services/ragService.js';
import { BenchmarkService } from './services/benchmarkService.js';
import { AuthenticatedUser, IngestDocumentDTO } from './types/api.types.js';

const program = new Command();
const ragService = new RAGService();
const benchmarkService = new BenchmarkService(ragService);

async function loadSampleData(): Promise<number> {
  const samplePath = path.join(__dirname, '../sample_data/enterprise_documents.json');
  if (!fs.existsSync(samplePath)) {
    console.error(`Sample data file not found at: ${samplePath}`);
    return 0;
  }

  const rawData = fs.readFileSync(samplePath, 'utf-8');
  const docs = JSON.parse(rawData) as IngestDocumentDTO[];

  let totalIngested = 0;
  for (const doc of docs) {
    const res = await ragService.ingestDocument(doc);
    totalIngested += res.chunksCreated;
  }
  return totalIngested;
}

program
  .name('metadata-rag')
  .description('Production-Grade Metadata-Filtered RAG Engine CLI')
  .version('1.0.0');

program
  .command('seed')
  .description('Seed the in-memory vector store with enterprise sample documents')
  .action(async () => {
    console.log('Seeding enterprise sample data...');
    const chunksCount = await loadSampleData();
    console.log(`✅ Seeding complete! Ingested ${chunksCount} chunks across multi-tenant enterprise documents.`);
  });

program
  .command('search')
  .description('Execute metadata-filtered vector search')
  .requiredOption('-q, --query <text>', 'Search query string')
  .option('-t, --tenant <tenantId>', 'Tenant ID filter', 'tenant_101')
  .option('-d, --department <dept>', 'Department filter')
  .option('-f, --file-type <type>', 'File type filter (pdf, md, txt)')
  .option('-m, --mode <mode>', 'Search mode: pre-filter or post-filter', 'pre-filter')
  .option('-k, --top-k <k>', 'Top-K results count', '5')
  .action(async (options) => {
    await loadSampleData();

    const user: AuthenticatedUser = {
      user_id: 'cli_user',
      tenant_id: options.tenant,
      access_level: 3,
    };

    const filter: Record<string, unknown> = {};
    if (options.department) filter.department = options.department;
    if (options.fileType) filter.file_type = options.fileType;

    console.log(`\n🔍 Running ${options.mode.toUpperCase()} Search for tenant "${options.tenant}"...`);
    console.log(`Query: "${options.query}"`);
    console.log(`Filter: ${JSON.stringify(filter)}`);

    const res = await ragService.search(
      {
        query: options.query,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        topK: parseInt(options.topK, 10),
        mode: options.mode as 'pre-filter' | 'post-filter',
      },
      user
    );

    console.log(`\nResults (${res.results.length} chunks retrieved, ${res.candidatesEvaluated} candidates evaluated, Latency: ${res.latencyMs}ms):`);
    console.log('-------------------------------------------------------------------');
    res.results.forEach((r, idx) => {
      console.log(`[${idx + 1}] Score: ${r.score.toFixed(4)} | Doc: ${r.chunk.metadata.document_id} | Dept: ${r.chunk.metadata.department} | Type: ${r.chunk.metadata.file_type}`);
      console.log(`    Content: "${r.chunk.content.substring(0, 120)}..."\n`);
    });
  });

program
  .command('query')
  .description('Execute full Metadata-Filtered RAG pipeline (Retrieval + LLM Answer)')
  .requiredOption('-q, --question <text>', 'User question')
  .option('-t, --tenant <tenantId>', 'Tenant ID', 'tenant_101')
  .option('-d, --department <dept>', 'Department filter')
  .option('-m, --mode <mode>', 'Search mode: pre-filter or post-filter', 'pre-filter')
  .action(async (options) => {
    await loadSampleData();

    const user: AuthenticatedUser = {
      user_id: 'cli_user',
      tenant_id: options.tenant,
      access_level: 3,
    };

    const filter: Record<string, unknown> = {};
    if (options.department) filter.department = options.department;

    console.log(`\n🤖 Executing Metadata-Filtered RAG Pipeline...`);
    console.log(`Question: "${options.question}"`);

    const res = await ragService.executeRAG(
      {
        question: options.question,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        mode: options.mode as 'pre-filter' | 'post-filter',
      },
      user
    );

    console.log(`\n💬 Generated Answer (${res.metadata.provider}):`);
    console.log('-------------------------------------------------------------------');
    console.log(res.answer);
    console.log('\n📊 Metadata Metrics:');
    console.log(`- Search Mode: ${res.metadata.searchMode}`);
    console.log(`- Applied Security Filter: ${JSON.stringify(res.metadata.appliedFilter)}`);
    console.log(`- Retrived Chunks: ${res.metadata.chunksRetrievedCount}`);
    console.log(`- Total Latency: ${res.metadata.totalLatencyMs}ms`);
  });

program
  .command('benchmark')
  .description('Run Pre-Filtering vs Post-Filtering benchmark analysis')
  .option('-q, --query <text>', 'Query string', 'refund policy')
  .option('-t, --tenant <tenantId>', 'Tenant ID to restrict', 'tenant_101')
  .action(async (options) => {
    await loadSampleData();

    const filter = { tenant_id: options.tenant };

    console.log(`\n📊 Running Pre-Filtering vs Post-Filtering Benchmark Analysis...`);
    console.log(`Query: "${options.query}", Filter: ${JSON.stringify(filter)}`);

    const report = await benchmarkService.compareFilterPerformance({
      query: options.query,
      filter,
      topK: 5,
      postFilterCandidateLimits: [2, 4, 6, 10],
    });

    console.log('\n===================================================================');
    console.log('BENCHMARK REPORT');
    console.log('===================================================================');
    console.log(`Pre-Filter (Ground Truth): ${report.preFilter.retrievedCount} results retrieved (${report.preFilter.candidatesEvaluated} candidates evaluated)`);
    console.log('\nPost-Filter Runs:');
    report.postFilterRuns.forEach((r) => {
      console.log(`- Candidate Limit ${r.candidateLimit}: ${r.retrievedCount} retrieved | Precision vs Pre-Filter: ${(r.precisionVersusPreFilter * 100).toFixed(0)}% | Starvation: ${r.zeroResultOccurred ? 'YES ⚠️' : 'No'}`);
    });
    console.log('\nAnalysis Recommendation:');
    console.log(`👉 ${report.analysis.recommendation}`);
  });

program.parse(process.argv);
