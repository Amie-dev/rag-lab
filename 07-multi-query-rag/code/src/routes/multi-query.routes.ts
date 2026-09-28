import { Router } from 'express';
import { multiQueryController } from '../controllers/multi-query.controller';

const router = Router();

router.post('/generate', (req, res, next) => multiQueryController.generateQueries(req, res, next));
router.post('/search', (req, res, next) => multiQueryController.search(req, res, next));

export default router;
