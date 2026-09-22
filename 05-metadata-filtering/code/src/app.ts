/**
 * Express Application Setup
 */

import express, { Express } from 'express';
import cors from 'cors';
import { RAGService } from './services/ragService';
import { BenchmarkService } from './services/benchmarkService';
import { authMiddleware } from './middlewares/auth.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { createApiRouter } from './routes/index';

export function createApp(
  ragService?: RAGService,
  benchmarkService?: BenchmarkService
): Express {
  const app = express();

  const activeRagService = ragService || new RAGService();
  const activeBenchmarkService = benchmarkService || new BenchmarkService(activeRagService);

  // Core Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(authMiddleware);

  // Mount API V1
  app.use('/api/v1', createApiRouter(activeRagService, activeBenchmarkService));

  // Centralized Error Handling
  app.use(errorMiddleware);

  return app;
}
