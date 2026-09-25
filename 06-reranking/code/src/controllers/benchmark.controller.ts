import { Request, Response, NextFunction } from 'express';
import { benchmarkService } from '../services/benchmark.service';
import { BenchmarkRequestSchema } from '../types';

export class BenchmarkController {
  /**
   * POST /api/v1/benchmark/evaluate
   * Executes candidate pool size sweep and reranking shift analysis.
   */
  async runEvaluation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = BenchmarkRequestSchema.parse(req.body);

      const report = await benchmarkService.runBenchmark(
        validated.queries,
        validated.candidateSizes,
        validated.topK,
        validated.retrievalMode,
        'local'
      );

      res.status(200).json({
        success: true,
        report,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const benchmarkController = new BenchmarkController();
