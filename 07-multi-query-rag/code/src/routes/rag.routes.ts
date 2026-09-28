import { Router } from 'express';
import { ragController } from '../controllers/rag.controller';

const router = Router();

router.post('/query', (req, res, next) => ragController.query(req, res, next));

export default router;
