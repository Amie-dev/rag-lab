/**
 * Pre-Filtering vs Post-Filtering Benchmark Controller
 */

import { Request, Response, NextFunction } from 'express';
import { BenchmarkService } from '../services/benchmarkService';
import { z } from 'zod';

export const benchmarkSchema = z.object({
  query: z.string().min(1, 'Benchmark query text is required'),
  filter: z.record(z.any()),
  topK: z.number().positive().optional(),
  postFilterCandidateLimits: z.array(z.number().positive()).optional(),
});

export class BenchmarkController {
  private benchmarkService: BenchmarkService;

  constructor(benchmarkService: BenchmarkService) {
    this.benchmarkService = benchmarkService;
  }

  public runComparison = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.benchmarkService.compareFilterPerformance(req.body);
      res.json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
