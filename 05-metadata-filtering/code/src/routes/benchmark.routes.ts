/**
 * Benchmark API Routes
 */

import { Router } from 'express';
import { BenchmarkController, benchmarkSchema } from '../controllers/benchmark.controller';
import { validateBody } from '../middlewares/validate.middleware';
import { BenchmarkService } from '../services/benchmarkService';

export function createBenchmarkRouter(benchmarkService: BenchmarkService): Router {
  const router = Router();
  const controller = new BenchmarkController(benchmarkService);

  router.post('/filter-comparison', validateBody(benchmarkSchema), controller.runComparison);

  return router;
}
