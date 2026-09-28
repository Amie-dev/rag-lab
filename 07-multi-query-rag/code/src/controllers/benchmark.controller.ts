import { Request, Response, NextFunction } from 'express';
import { BenchmarkRequestSchema } from '../types';
import { benchmarkService } from '../services/benchmark.service';

export class BenchmarkController {
  async compare(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = BenchmarkRequestSchema.parse(req.body);
      const summary = await benchmarkService.runBenchmark(validatedInput);

      return res.status(200).json({
        success: true,
        ...summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const benchmarkController = new BenchmarkController();
