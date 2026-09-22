/**
 * Metadata-Filtered Search Controller
 */

import { Request, Response, NextFunction } from 'express';
import { RAGService } from '../services/ragService.js';
import { z } from 'zod';

export const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  filter: z.record(z.any()).optional(),
  topK: z.number().positive().optional(),
  mode: z.enum(['pre-filter', 'post-filter']).optional(),
  postFilterCandidateLimit: z.number().positive().optional(),
  bypassAuthGuard: z.boolean().optional(),
});

export class SearchController {
  private ragService: RAGService;

  constructor(ragService: RAGService) {
    this.ragService = ragService;
  }

  public search = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.ragService.search(req.body, req.user);
      res.json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
