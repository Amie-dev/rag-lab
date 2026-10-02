import cors from 'cors';
import express, { Express } from 'express';
import fs from 'fs';
import path from 'path';
import { errorHandler } from './middlewares/error.middleware';
import hydeRoutes from './routes/hyde.routes';
import { vectorStoreService } from './services/vector-store.service';
import { Document } from './types';

export const createApp = async (): Promise<Express> => {
  const app: Express = express();

  app.use(cors());
  app.use(express.json());

  // Mount API routes
  app.use('/api/v1/hyde', hydeRoutes);

  // Global Error Handler
  app.use(errorHandler);

  // Auto-ingest sample dataset on boot if store empty
  await initializeSampleData();

  return app;
};

export const initializeSampleData = async (): Promise<void> => {
  if (vectorStoreService.isReady()) return;

  const samplePath = path.resolve(__dirname, '../sample_data/documents.json');
  if (fs.existsSync(samplePath)) {
    try {
      const fileData = fs.readFileSync(samplePath, 'utf-8');
      const docs: Document[] = JSON.parse(fileData);
      const chunkCount = await vectorStoreService.ingestDocuments(docs);
      console.log(`✅ Loaded ${docs.length} sample documents (${chunkCount} vector chunks) into memory.`);
    } catch (error) {
      console.warn('⚠️ Failed to load sample documents JSON:', error);
    }
  }
};
