# Chapter 8 — Interactive CLI & Unit Testing Suite

To complete our production-grade Basic RAG system, we build an interactive Command-Line Interface (CLI) and an automated Jest unit test suite.

---

## 1. Command-Line Interface (`src/cli.ts`)

The CLI provides two main subcommands:
- `basic-rag ingest --path <file_or_dir>`
- `basic-rag ask --question "<query>"`

### Full Source Code

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfigFromEnv } from './config';
import { BasicRAGPipeline } from './pipeline/basicRag';
import { TextDocumentLoader } from './loaders/text';

dotenv.config();

const program = new Command();

program
  .name('basic-rag')
  .description('Production-grade Basic (Naive) RAG CLI Engine')
  .version('1.0.0');

program
  .command('ingest')
  .description('Ingest documents from a file or directory into vector store')
  .requiredOption('-p, --path <path>', 'Path to file or directory')
  .option('-c, --chunk-size <number>', 'Chunk size', (val) => parseInt(val, 10))
  .option('-o, --chunk-overlap <number>', 'Chunk overlap', (val) => parseInt(val, 10))
  .action(async (options) => {
    try {
      const config = loadConfigFromEnv();
      if (options.chunkSize) config.chunkSize = options.chunkSize;
      if (options.chunkOverlap) config.chunkOverlap = options.chunkOverlap;

      console.log(`\n📥 Starting Document Ingestion Phase...`);
      console.log(`- Path: ${options.path}`);
      console.log(`- Provider: Embeddings=${config.embeddingProvider}, LLM=${config.llmProvider}`);
      console.log(`- Settings: ChunkSize=${config.chunkSize}, Overlap=${config.chunkOverlap}\n`);

      const pipeline = new BasicRAGPipeline(config);
      const targetPath = path.resolve(options.path);

      if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
        const textLoader = new TextDocumentLoader();
        const docs = await textLoader.loadDirectory(targetPath);
        console.log(`Found ${docs.length} supported document file(s) in directory.`);
        let totalIndexed = 0;
        for (const doc of docs) {
          const res = await pipeline.ingest(doc.content);
          totalIndexed += res.count;
          console.log(`  ✓ Indexed "${doc.metadata.filename || doc.metadata.source}": ${res.chunks.length} chunk(s)`);
        }
        console.log(`\n✅ Ingestion Complete! Total indexed chunks: ${totalIndexed}\n`);
      } else {
        const res = await pipeline.ingest(targetPath);
        console.log(`✅ Ingestion Complete! Loaded ${res.documents.length} document(s), generated ${res.chunks.length} chunk(s).\n`);
      }
    } catch (err: unknown) {
      console.error(`❌ Ingestion failed:`, (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('ask')
  .description('Run Retrieval & Generation Phase for a user question')
  .requiredOption('-q, --question <question>', 'User query string')
  .option('-d, --dir <dir>', 'Optional sample directory to ingest before query', 'sample_data')
  .option('-k, --top-k <number>', 'Top-K chunks to retrieve', (val) => parseInt(val, 10))
  .option('-m, --metric <metric>', 'Similarity metric (cosine, dot_product, euclidean)')
  .action(async (options) => {
    try {
      const config = loadConfigFromEnv();
      if (options.topK) config.topK = options.topK;
      if (options.metric) config.similarityMetric = options.metric;

      const pipeline = new BasicRAGPipeline(config);

      const sampleDir = path.resolve(options.dir);
      if (fs.existsSync(sampleDir) && fs.statSync(sampleDir).isDirectory()) {
        const textLoader = new TextDocumentLoader();
        const docs = await textLoader.loadDirectory(sampleDir);
        for (const doc of docs) {
          await pipeline.ingest(doc.content);
        }
      }

      console.log(`\n🔎 Executing Basic RAG Retrieval & Generation...`);
      console.log(`- Question: "${options.question}"`);
      console.log(`- Top-K Chunks: ${config.topK}`);
      console.log(`- Similarity Metric: ${config.similarityMetric}\n`);

      const response = await pipeline.query(options.question);

      console.log(`════════════════════════════════════════════════════════════`);
      console.log(`🤖 LLM Response (${response.metadata.model}):`);
      console.log(`════════════════════════════════════════════════════════════`);
      console.log(response.answer);
      console.log(`════════════════════════════════════════════════════════════\n`);

      console.log(`📚 Top-K Retrieved Context Chunks (${response.contextChunks.length}):`);
      response.contextChunks.forEach((c, idx) => {
        console.log(` [Chunk ${idx + 1}] Score: ${c.score.toFixed(4)} | Doc: ${c.chunk.metadata.filename || c.chunk.metadata.source}`);
        console.log(` "${c.chunk.content.substring(0, 150).replace(/\n/g, ' ')}..."\n`);
      });

      console.log(`⏱️ Latency: Retrieval=${response.metadata.retrievalLatencyMs}ms, Generation=${response.metadata.generationLatencyMs}ms, Total=${response.metadata.totalLatencyMs}ms\n`);
    } catch (err: unknown) {
      console.error(`❌ Query execution failed:`, (err as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);
```

---

## 2. Unit Testing Suite (`tests/*`)

### End-to-End Pipeline Test (`tests/pipeline.test.ts`)

```typescript
import { BasicRAGPipeline } from '../src/pipeline/basicRag';

describe('BasicRAGPipeline End-to-End', () => {
  let pipeline: BasicRAGPipeline;

  beforeEach(() => {
    pipeline = new BasicRAGPipeline({
      chunkSize: 100,
      chunkOverlap: 20,
      topK: 2,
      embeddingProvider: 'mock',
      llmProvider: 'mock',
    });
  });

  test('ingests content and queries basic RAG system', async () => {
    const ingestRes = await pipeline.ingest(
      'Basic RAG connects a document ingestion pipeline to a vector store. It retrieves top-K relevant chunks for user questions and generates answers using LLM.'
    );

    expect(ingestRes.documents).toHaveLength(1);
    expect(ingestRes.chunks.length).toBeGreaterThan(0);
    expect(await pipeline.getIndexedChunkCount()).toBe(ingestRes.chunks.length);

    const response = await pipeline.query('What is Basic RAG?');
    expect(response.question).toBe('What is Basic RAG?');
    expect(response.contextChunks).toHaveLength(2);
    expect(response.answer).toContain('Basic RAG');
    expect(response.metadata.model).toBe('mock-llm-v1');
    expect(response.metadata.totalLatencyMs).toBeGreaterThanOrEqual(0);
  });
});
```

---

## 3. Running Build & Tests

Execute the following commands in terminal:

```bash
# Build TypeScript
npm run build

# Run unit tests
npm test
```
