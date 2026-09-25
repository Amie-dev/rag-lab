import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { inMemoryVectorStore } from './vectordb/in-memory-vector-store';
import { embeddingService } from './services/embedding.service';
import { retrievalPipelineService } from './services/retrieval-pipeline.service';
import { llmService } from './services/llm.service';
import { benchmarkService } from './services/benchmark.service';
import { DocumentChunk, PipelineOptions, RerankerProvider, RetrievalMode } from './types';

const program = new Command();

program
  .name('reranking-rag')
  .description('Production-grade Two-Stage Reranking RAG CLI Tool')
  .version('1.0.0');

async function ensureSeeded() {
  if (inMemoryVectorStore.count() === 0) {
    const samplePath = path.resolve(__dirname, '../sample_data/documents.json');
    if (fs.existsSync(samplePath)) {
      const fileData = fs.readFileSync(samplePath, 'utf-8');
      const rawChunks: Array<{ id: string; content: string; metadata: any }> = JSON.parse(fileData);

      const chunksWithEmbeddings: DocumentChunk[] = [];
      for (const item of rawChunks) {
        const textToEmbed = `${item.metadata?.title || ''} ${item.content}`;
        const embedding = await embeddingService.generateEmbedding(textToEmbed);
        chunksWithEmbeddings.push({
          id: item.id,
          content: item.content,
          metadata: item.metadata || {},
          embedding,
        });
      }

      inMemoryVectorStore.upsertChunks(chunksWithEmbeddings);
    }
  }
}

// Command 1: Seed Dataset
program
  .command('seed')
  .description('Seed vector store with sample documentation dataset')
  .action(async () => {
    console.log('🌱 Seeding vector store with enterprise documents...');
    await ensureSeeded();
    console.log(`✅ Success! Seeded ${inMemoryVectorStore.count()} document chunks.`);
  });

// Command 2: Search (Stage 1 + Stage 2 Reranking)
program
  .command('search')
  .description('Execute Two-Stage candidate retrieval & reranking search')
  .requiredOption('-q, --query <string>', 'Search query')
  .option('-n, --candidate-top-n <number>', 'Stage 1 candidate pool size', '20')
  .option('-k, --final-top-k <number>', 'Stage 2 reranked top-K output', '5')
  .option('-m, --mode <string>', 'Retrieval mode (dense|sparse|hybrid)', 'hybrid')
  .option('-p, --provider <string>', 'Reranker provider (local|openai-structured|cohere)', 'local')
  .action(async (options) => {
    await ensureSeeded();

    const pipelineOpts: PipelineOptions = {
      stage1CandidateTopN: parseInt(options.candidateTopN, 10),
      stage2FinalTopK: parseInt(options.finalTopK, 10),
      retrievalMode: options.mode as RetrievalMode,
      rerankerProvider: options.provider as RerankerProvider,
    };

    console.log(`\n🔍 Executing Two-Stage Search for Query: "${options.query}"`);
    console.log(`   Pipeline Config: Mode=${pipelineOpts.retrievalMode} | Candidate Top-N=${pipelineOpts.stage1CandidateTopN} | Final Top-K=${pipelineOpts.stage2FinalTopK} | Reranker=${pipelineOpts.rerankerProvider}\n`);

    const result = await retrievalPipelineService.executePipeline(options.query, pipelineOpts);

    console.log(`⏱️ Latency Metrics: Stage 1=${result.metrics.stage1LatencyMs}ms | Stage 2 Reranker=${result.metrics.stage2LatencyMs}ms | Total=${result.metrics.totalLatencyMs}ms`);
    console.log(`🔄 Top #1 Rank Shifted after Reranking: ${result.metrics.topRankShift ? 'YES ⚡' : 'NO (Unchanged)'}\n`);

    console.log('========================================================================================');
    console.log('📌 TOP RERANKED CONTEXT RESULTS (Stage 2 High Precision):');
    console.log('========================================================================================');

    result.rerankedResults.forEach((res) => {
      const deltaStr = res.rankDelta > 0 ? `+${res.rankDelta} ⬆️` : res.rankDelta < 0 ? `${res.rankDelta} ⬇️` : '0 ➖';
      console.log(`[Rank #${res.finalRank}] Chunk ID: ${res.chunk.id} (Stage 1 Rank: #${res.stage1Rank} | Rank Movement: ${deltaStr})`);
      console.log(`  Title: ${res.chunk.metadata.title}`);
      console.log(`  Stage 1 Score (${res.retrievalMethod}): ${res.stage1Score} | Stage 2 Cross-Encoder Score: ${res.stage2Score}`);
      console.log(`  Reasoning: ${res.reasoning || 'N/A'}`);
      console.log(`  Snippet: ${res.chunk.content.substring(0, 120)}...\n`);
    });
  });

// Command 3: Query RAG
program
  .command('query')
  .description('Execute full Two-Stage Reranking RAG pipeline with Structured Output generation')
  .requiredOption('-q, --question <string>', 'Question to ask')
  .option('-n, --candidate-top-n <number>', 'Stage 1 candidate pool size', '20')
  .option('-k, --final-top-k <number>', 'Stage 2 reranked top-K output', '5')
  .option('-p, --provider <string>', 'Reranker provider (local|openai-structured|cohere)', 'local')
  .action(async (options) => {
    await ensureSeeded();

    const pipelineOpts: PipelineOptions = {
      stage1CandidateTopN: parseInt(options.candidateTopN, 10),
      stage2FinalTopK: parseInt(options.finalTopK, 10),
      retrievalMode: 'hybrid',
      rerankerProvider: options.provider as RerankerProvider,
    };

    console.log(`\n🤖 Processing RAG Query: "${options.question}"...`);

    const pipelineResult = await retrievalPipelineService.executePipeline(options.question, pipelineOpts);
    const answer = await llmService.generateAnswer(options.question, pipelineResult.rerankedResults);

    console.log('\n========================================================================================');
    console.log('💡 GENERATED GROUNDED ANSWER:');
    console.log('========================================================================================');
    console.log(answer.answer);
    console.log(`\n🎯 Confidence Score: ${(answer.confidenceScore * 100).toFixed(1)}%`);
    console.log(`📚 Cited Chunk IDs: ${answer.citedChunkIds.join(', ')}`);
    console.log('\n🔑 Key Insights Extracted:');
    answer.keyInsights.forEach((insight) => console.log(`   - ${insight}`));
    console.log('========================================================================================\n');
  });

// Command 4: Benchmark Report
program
  .command('benchmark')
  .description('Run benchmark report evaluating Stage 1 vs Stage 2 reranking metrics')
  .action(async () => {
    await ensureSeeded();

    console.log('📊 Executing Quantitative Reranking Benchmark Suite...\n');
    const report = await benchmarkService.runBenchmark();

    console.log('========================================================================================');
    console.log('📈 RERANKING BENCHMARK EXECUTIVE SUMMARY');
    console.log('========================================================================================');
    console.log(`Total Queries Evaluated: ${report.totalQueriesEvaluated}`);
    console.log(`Total Dataset Documents: ${report.totalDatasetDocuments}`);
    console.log(`Retrieval Mode: ${report.retrievalMode} | Reranker Engine: ${report.rerankerProvider}`);
    console.log(`Top #1 Candidate Rank Swap Rate: ${report.topRankShiftPercentage}% (${report.topRankShiftCount}/${report.totalQueriesEvaluated} queries)`);
    console.log(`Average Stage 1 Retrieval Latency: ${report.avgStage1LatencyMs} ms`);
    console.log(`Average Stage 2 Reranking Latency: ${report.avgStage2LatencyMs} ms`);
    console.log(`Average Total Pipeline Latency: ${report.avgTotalLatencyMs} ms\n`);

    console.log('📋 CANDIDATE POOL SIZE (N) SWEEP ANALYSIS:');
    console.table(report.candidateSizeSweep);

    console.log('\n🔎 QUERY-BY-QUERY RANK MOVEMENT SAMPLES:');
    report.detailedQueryResults.forEach((q, idx) => {
      console.log(`\nQuery ${idx + 1}: "${q.query}"`);
      console.log(`  Stage 1 #1 Candidate: ${q.stage1Top1ChunkId}`);
      console.log(`  Stage 2 #1 Candidate: ${q.stage2Top1ChunkId} (Top Shift: ${q.topRankShifted ? 'YES ⚡' : 'NO'})`);
    });
    console.log('\n========================================================================================\n');
  });

program.parse(process.argv);
