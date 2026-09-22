/**
 * Search API Routes
 */

import { Router } from 'express';
import { SearchController, searchSchema } from '../controllers/search.controller.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { RAGService } from '../services/ragService.js';

export function createSearchRouter(ragService: RAGService): Router {
  const router = Router();
  const controller = new SearchController(ragService);

  router.post('/', validateBody(searchSchema), controller.search);

  return router;
}
