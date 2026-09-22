/**
 * Health Check Router
 */

import { Router } from 'express';
import { HealthController } from '../controllers/health.controller.js';
import { RAGService } from '../services/ragService.js';

export function createHealthRouter(ragService: RAGService): Router {
  const router = Router();
  const controller = new HealthController(ragService);

  router.get('/', controller.getHealth);

  return router;
}
