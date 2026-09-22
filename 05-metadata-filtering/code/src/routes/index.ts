/**
 * API Router Aggregator
 */

import { Router } from 'express';
import { RAGService } from '../services/ragService';
import { BenchmarkService } from '../services/benchmarkService';
import { createDocumentRouter } from './document.routes';
import { createSearchRouter } from './search.routes';
import { createRAGRouter } from './rag.routes';
import { createBenchmarkRouter } from './benchmark.routes';
import { createHealthRouter } from './health.routes';

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
