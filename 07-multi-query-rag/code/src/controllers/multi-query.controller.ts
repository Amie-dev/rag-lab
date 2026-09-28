import { Request, Response, NextFunction } from 'express';
import { MultiQuerySearchRequestSchema } from '../types';
import { multiQueryGeneratorService } from '../services/multi-query-generator.service';
import { multiQueryRAGService } from '../services/multi-query-rag.service';

export class MultiQueryController {
  async generateQueries(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, numQueries } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ success: false, error: 'Query parameter is required and must be a string' });
      }

      const count = typeof numQueries === 'number' ? numQueries : 4;
      const variations = await multiQueryGeneratorService.generateQueryVariations(query, count);

      return res.status(200).json({
        success: true,
        originalQuery: query,
        generatedCount: variations.length,
        variations,
      });
    } catch (error) {
      next(error);
    }
  }

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = MultiQuerySearchRequestSchema.parse(req.body);
      const searchResult = await multiQueryRAGService.search(validatedInput);

      return res.status(200).json({
        success: true,
        ...searchResult,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const multiQueryController = new MultiQueryController();
