/**
 * RAG API Routes
 */

import { Router } from 'express';
import { RAGController, ragQuerySchema } from '../controllers/rag.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { RAGService } from '../services/ragService.js';

export function createRAGRouter(ragService: RAGService): Router {
  const router = Router();
  const controller = new RAGController(ragService);

  router.post('/query', validateBody(ragQuerySchema), controller.query);

  return router;
}
