import { Router } from 'express';
import { retrievalController } from '../controllers/retrieval.controller';

const router = Router();

router.post('/search', (req, res, next) => retrievalController.search(req, res, next));
router.post('/rerank', (req, res, next) => retrievalController.rerankDirect(req, res, next));

export default router;
