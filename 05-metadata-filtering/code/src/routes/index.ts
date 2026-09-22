/**
 * API Router Aggregator
 */

import { Router } from 'express';
import { RAGService } from '../services/ragService.js';
import { BenchmarkService } from '../services/benchmarkService.js';
import { createDocumentRouter } from './document.routes.js';
import { createSearchRouter } from './search.routes.js';
import { createRAGRouter } from './rag.routes.js';
import { createBenchmarkRouter } from './benchmark.routes.js';
import { createHealthRouter } from './health.routes.js';

export function createApiRouter(
  ragService: RAGService,
  benchmarkService: BenchmarkService
): Router {
  const apiRouter = Router();

  apiRouter.use('/documents', createDocumentRouter(ragService));
  apiRouter.use('/search', createSearchRouter(ragService));
  apiRouter.use('/rag', createRAGRouter(ragService));
  apiRouter.use('/benchmark', createBenchmarkRouter(benchmarkService));
  apiRouter.use('/health', createHealthRouter(ragService));

  return apiRouter;
}
