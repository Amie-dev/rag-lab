import { Router } from 'express';
import { documentController } from '../controllers/document.controller';

const router = Router();

router.post('/ingest', (req, res, next) => documentController.ingest(req, res, next));
router.post('/seed', (req, res, next) => documentController.seed(req, res, next));
router.get('/list', (req, res, next) => documentController.list(req, res, next));
router.delete('/clear', (req, res, next) => documentController.clear(req, res, next));

export default router;
