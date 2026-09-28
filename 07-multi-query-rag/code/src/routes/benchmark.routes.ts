import { Router } from 'express';
import { benchmarkController } from '../controllers/benchmark.controller';

const router = Router();

router.post('/compare', (req, res, next) => benchmarkController.compare(req, res, next));

export default router;
