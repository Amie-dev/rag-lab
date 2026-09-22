/**
 * RAG Execution Controller
 */

import { Request, Response, NextFunction } from 'express';
import { RAGService } from '../services/ragService';
import { z } from 'zod';

export const ragQuerySchema = z.object({
  question: z.string().min(1, 'Question is required'),
  filter: z.record(z.any()).optional(),
  topK: z.number().positive().optional(),
  mode: z.enum(['pre-filter', 'post-filter']).optional(),
  postFilterCandidateLimit: z.number().positive().optional(),
  systemPrompt: z.string().optional(),
});

export class RAGController {
  private ragService: RAGService;

  constructor(ragService: RAGService) {
    this.ragService = ragService;
  }

  public query = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const response = await this.ragService.executeRAG(req.body, req.user!);
      res.json({
        data: response,
      });
    } catch (err) {
      next(err);
    }
  };
}
