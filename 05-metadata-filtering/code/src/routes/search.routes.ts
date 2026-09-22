/**
 * Search API Routes
 */

import { Router } from 'express';
import { SearchController, searchSchema } from '../controllers/search.controller';
import { validateBody } from '../middlewares/validate.middleware';
import { RAGService } from '../services/ragService';

export function createSearchRouter(ragService: RAGService): Router {
  const router = Router();
  const controller = new SearchController(ragService);

  router.post('/', validateBody(searchSchema), controller.search);

  return router;
}
