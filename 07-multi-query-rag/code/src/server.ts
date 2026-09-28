import { app } from './app';
import { config } from './config/environment';
import { vectorStoreService } from './services/vector-store.service';
import fs from 'fs';
import path from 'path';

const PORT = config.port;

const startServer = async () => {
  // Auto-seed sample dataset if empty
  try {
    const samplePath = path.resolve(process.cwd(), 'sample_data/documents.json');
    if (fs.existsSync(samplePath)) {
      const rawData = fs.readFileSync(samplePath, 'utf-8');
      const docs = JSON.parse(rawData);
      await vectorStoreService.bulkIngestDocuments(docs);
      console.log(`[Auto-Seed] Pre-loaded ${docs.length} sample document chunks into vector database.`);
    }
  } catch (err) {
    console.warn('[Auto-Seed Warning] Could not auto-seed sample dataset:', err);
  }

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Multi-Query RAG Engine Server Running on Port ${PORT}`);
    console.log(`📡 Base URL: http://localhost:${PORT}/api/v1`);
    console.log(`🔑 OpenAI API: ${config.openaiApiKey ? 'Configured' : 'Local Fallback Mode'}`);
    console.log(`====================================================`);
  });
};

if (require.main === module) {
  startServer();
}
