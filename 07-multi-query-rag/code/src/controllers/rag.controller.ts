import { Request, Response, NextFunction } from 'express';
import { MultiQueryRAGRequestSchema } from '../types';
import { multiQueryRAGService } from '../services/multi-query-rag.service';

export class RAGController {
  async query(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = MultiQueryRAGRequestSchema.parse(req.body);
      const result = await multiQueryRAGService.executeRAG(validatedInput);

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const ragController = new RAGController();
