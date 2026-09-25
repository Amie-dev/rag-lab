import { app } from './app';
import { config } from './config/environment';
import fs from 'fs';
import path from 'path';
import { inMemoryVectorStore } from './vectordb/in-memory-vector-store';
import { embeddingService } from './services/embedding.service';
import { DocumentChunk } from './types';

async function bootstrap() {
  // Auto-seed sample dataset if vector store is empty on startup
  try {
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
      console.log(`[Auto-Seed] Loaded ${chunksWithEmbeddings.length} document chunks into Vector Store.`);
    }
  } catch (err) {
    console.warn('[Auto-Seed] Could not auto-seed sample dataset:', err);
  }

  app.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Reranking RAG Backend API running on port ${config.port}`);
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   OpenAI SDK Configured: ${Boolean(config.openaiApiKey)}`);
    console.log(`   Cohere API Configured: ${Boolean(config.cohereApiKey)}`);
    console.log(`   Health Check: http://localhost:${config.port}/api/v1/health`);
    console.log(`=======================================================`);
  });
}

bootstrap();
