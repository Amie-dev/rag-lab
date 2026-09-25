import { Router } from 'express';
import { benchmarkController } from '../controllers/benchmark.controller';

const router = Router();

router.post('/evaluate', (req, res, next) => benchmarkController.runEvaluation(req, res, next));

export default router;
