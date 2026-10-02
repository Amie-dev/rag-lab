import { Router } from 'express';
import { hydeController } from '../controllers/hyde.controller';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  BenchmarkRequestSchema,
  HyDERAGSchema,
  HyDESearchSchema,
  HypotheticalDocGenerationSchema,
} from '../types';

const router = Router();

router.get('/health', (req, res, next) => hydeController.health(req, res, next));
router.get('/documents', (req, res, next) => hydeController.getDocuments(req, res, next));
router.post('/documents/ingest', (req, res, next) => hydeController.ingest(req, res, next));

router.post(
  '/generate-hypothetical',
  validateRequest(HypotheticalDocGenerationSchema),
  (req, res, next) => hydeController.generateHypothetical(req, res, next)
);

router.post(
  '/search',
  validateRequest(HyDESearchSchema),
  (req, res, next) => hydeController.search(req, res, next)
);

router.post(
  '/rag',
  validateRequest(HyDERAGSchema),
  (req, res, next) => hydeController.executeRAG(req, res, next)
);

router.post(
  '/benchmark',
  validateRequest(BenchmarkRequestSchema),
  (req, res, next) => hydeController.benchmark(req, res, next)
);

export default router;
