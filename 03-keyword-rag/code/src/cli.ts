#!/usr/bin/env node
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { KeywordRAGPipeline } from './pipeline/rag_pipeline';
import { AnalyzerType, ScoringAlgorithm } from './schemas';

dotenv.config();

const program = new Command();

program
  .name('keyword-rag')
  .description('Production-grade Keyword / Sparse RAG CLI with BM25 & Inverted Index')
  .version('1.0.0');

program
  .command('search')
  .description('Search documents using BM25 or TF-IDF lexical search')
  .argument('<query>', 'Search query string')
  .option('-f, --file <path>', 'File path to index and search', 'sample_data/technical_docs.md')
  .option('-a, --analyzer <type>', 'Analyzer type: standard, technical, simple', 'technical')
  .option('-s, --algorithm <algo>', 'Scoring algorithm: bm25, tfidf', 'bm25')
  .option('-k, --topK <number>', 'Number of top results to return', '3')
  .option('-e, --explain', 'Show detailed score breakdown per term', false)
  .action(async (query: string, options) => {
    try {
      const filePath = path.resolve(options.file);
      const pipeline = new KeywordRAGPipeline({
        analyzerType: options.analyzer as AnalyzerType,
        scoringAlgorithm: options.algorithm as ScoringAlgorithm,
      });

      console.log(`\n🔍 Indexing file: ${filePath}`);
      const chunks = await pipeline.ingestFile(filePath);
      console.log(`✅ Indexed ${chunks.length} chunks successfully.\n`);

      const topK = parseInt(options.topK, 10);
      console.log(`🔎 Executing Search: "${query}" (Algorithm: ${options.algorithm.toUpperCase()}, Analyzer: ${options.analyzer})\n`);

      const results = pipeline.search({
        query,
        topK,
        algorithm: options.algorithm as ScoringAlgorithm,
        analyzerType: options.analyzer as AnalyzerType,
        explain: options.explain,
      });

      if (results.length === 0) {
        console.log('❌ No matching documents found.');
        return;
      }

      results.forEach((res, idx) => {
        console.log(`--------------------------------------------------`);
        console.log(`Rank #${idx + 1} | Score: ${res.score.toFixed(4)} (BM25: ${res.bm25Score.toFixed(4)}, TFIDF: ${res.tfidfScore.toFixed(4)})`);
        console.log(`Chunk ID: ${res.chunk.id} | Source: ${res.chunk.metadata.filename}`);
        console.log(`Matched Terms: [${res.matchedTerms.join(', ')}]`);
        console.log(`\nContent Snippet:\n${res.chunk.content.trim()}\n`);

        if (res.explanation) {
          console.log(`Score Explanation:`);
          res.explanation.termDetails.forEach((td) => {
            console.log(
              `  - Term: "${td.term}" | Raw TF: ${td.rawTf} | IDF: ${td.idf.toFixed(4)} | Score Weight: ${td.scoreContribution.toFixed(4)}`
            );
          });
          console.log(
            `  - Doc Length: ${res.explanation.documentLength} | Avg Doc Length: ${res.explanation.avgDocumentLength.toFixed(1)}\n`
          );
        }
      });
    } catch (err: any) {
      console.error('❌ Error executing search:', err.message || err);
      process.exit(1);
    }
  });

program
  .command('query')
  .description('Run RAG pipeline to answer questions using retrieved lexical context')
  .argument('<question>', 'Question to ask')
  .option('-f, --file <path>', 'File path to index and search', 'sample_data/technical_docs.md')
  .option('-a, --analyzer <type>', 'Analyzer type: standard, technical, simple', 'technical')
  .option('-s, --algorithm <algo>', 'Scoring algorithm: bm25, tfidf', 'bm25')
  .option('-k, --topK <number>', 'Number of top chunks to retrieve', '3')
  .action(async (question: string, options) => {
    try {
      const filePath = path.resolve(options.file);
      const pipeline = new KeywordRAGPipeline({
        analyzerType: options.analyzer as AnalyzerType,
        scoringAlgorithm: options.algorithm as ScoringAlgorithm,
      });

      console.log(`\n📚 Ingesting file: ${filePath}`);
      const chunks = await pipeline.ingestFile(filePath);
      console.log(`✅ Total Chunks Indexed: ${chunks.length}\n`);

      console.log(`🤖 Generating Answer for Question: "${question}"...\n`);

      const response = await pipeline.query(question, {
        topK: parseInt(options.topK, 10),
        analyzerType: options.analyzer as AnalyzerType,
        algorithm: options.algorithm as ScoringAlgorithm,
      });

      console.log(`==================================================`);
      console.log(`ANSWER (Model: ${response.metadata.model}):`);
      console.log(`==================================================`);
      console.log(`${response.answer.trim()}\n`);

      console.log(`==================================================`);
      console.log(`RETRIEVED CONTEXT CITATIONS (${response.contextChunks.length} chunks):`);
      console.log(`==================================================`);
      response.contextChunks.forEach((c, idx) => {
        console.log(`[${idx + 1}] Chunk ID: ${c.chunk.id} (Score: ${c.score.toFixed(4)})`);
        console.log(`    Matched Terms: ${c.matchedTerms.join(', ')}`);
      });

      console.log(`\nLatency Stats:`);
      console.log(`  - Retrieval Latency: ${response.metadata.retrievalLatencyMs} ms`);
      console.log(`  - Generation Latency: ${response.metadata.generationLatencyMs} ms`);
      console.log(`  - Total Latency: ${response.metadata.totalLatencyMs} ms\n`);
    } catch (err: any) {
      console.error('❌ Error executing query:', err.message || err);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('View index statistics for a document file')
  .option('-f, --file <path>', 'File path to index', 'sample_data/technical_docs.md')
  .action(async (options) => {
    try {
      const filePath = path.resolve(options.file);
      const pipeline = new KeywordRAGPipeline({ analyzerType: 'technical' });
      await pipeline.ingestFile(filePath);

      const stats = pipeline.getSearchEngine().getIndex().getStats();
      console.log(`\n📊 Inverted Index Statistics:`);
      console.log(`  - Total Documents/Chunks: ${stats.totalDocuments}`);
      console.log(`  - Total Tokens: ${stats.totalTerms}`);
      console.log(`  - Vocabulary Size (Unique Terms): ${stats.vocabularySize}`);
      console.log(`  - Average Document Length: ${stats.avgDocLength.toFixed(2)} tokens\n`);
    } catch (err: any) {
      console.error('❌ Error getting index stats:', err.message || err);
      process.exit(1);
    }
  });

program.parse(process.argv);
