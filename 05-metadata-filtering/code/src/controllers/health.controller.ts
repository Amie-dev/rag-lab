/**
 * System Health and Database Statistics Controller
 */

import { Request, Response, NextFunction } from 'express';
import { RAGService } from '../services/ragService';
import { config } from '../config/index';

export class HealthController {
  private ragService: RAGService;

  constructor(ragService: RAGService) {
    this.ragService = ragService;
  }

  public getHealth = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = this.ragService.getVectorStore().getStats();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.env,
        openAiEnabled: Boolean(config.openaiApiKey),
        embeddingModel: config.embeddingModel,
        llmModel: config.llmModel,
        databaseStats: stats,
      });
    } catch (err) {
      next(err);
    }
  };
}
