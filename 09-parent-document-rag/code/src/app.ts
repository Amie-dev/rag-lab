import cors from 'cors';
import express, { Express } from 'express';
import fs from 'fs';
import path from 'path';
import { errorHandler } from './middlewares/error.middleware';
import parentDocumentRoutes from './routes/parent-document.routes';
import { indexingService } from './services/indexing.service';
import { Document } from './types';

export const createApp = async (): Promise<Express> => {
  const app: Express = express();

  app.use(cors());
  app.use(express.json());

  // Mount API routes
  app.use('/api/v1/parent-document', parentDocumentRoutes);

  // Global error handler
  app.use(errorHandler);

  // Auto-ingest the sample dataset on boot if the knowledge base is empty.
  await initializeSampleData();

  return app;
};

export const initializeSampleData = async (): Promise<void> => {
  if (indexingService.isReady()) return;

  const samplePath = path.resolve(__dirname, '../sample_data/documents.json');
  if (fs.existsSync(samplePath)) {
    try {
      const fileData = fs.readFileSync(samplePath, 'utf-8');
      const docs: Document[] = JSON.parse(fileData);
      const stats = await indexingService.ingestDocuments(docs);
      console.log(
        `✅ Loaded ${stats.documentsIngested} sample documents (${stats.parentsCreated} parent chunks → ${stats.childrenCreated} child chunks).`
      );
    } catch (error) {
      console.warn('⚠️ Failed to load sample documents JSON:', error);
    }
  }
};
