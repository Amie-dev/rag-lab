/**
 * Document API Routes
 */

import { Router } from 'express';
import { DocumentController, ingestDocumentSchema } from '../controllers/document.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { RAGService } from '../services/ragService.js';

export function createDocumentRouter(ragService: RAGService): Router {
  const router = Router();
  const controller = new DocumentController(ragService);

  router.post('/ingest', validateBody(ingestDocumentSchema), controller.ingest);
  router.delete('/:id', controller.deleteDocument);

  return router;
}
