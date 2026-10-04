import { Router } from 'express';
import { parentDocumentController } from '../controllers/parent-document.controller';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  BenchmarkRequestSchema,
  IngestDocumentsSchema,
  ParentDocumentRAGSchema,
  ParentDocumentSearchSchema,
} from '../types';

const router = Router();

router.get('/health', (req, res, next) => parentDocumentController.health(req, res, next));
router.get('/documents', (req, res, next) => parentDocumentController.getDocuments(req, res, next));
router.get('/parents', (req, res, next) => parentDocumentController.getParents(req, res, next));

router.post('/documents/ingest', validateRequest(IngestDocumentsSchema), (req, res, next) =>
  parentDocumentController.ingest(req, res, next)
);

router.post('/search', validateRequest(ParentDocumentSearchSchema), (req, res, next) =>
  parentDocumentController.search(req, res, next)
);

router.post('/rag', validateRequest(ParentDocumentRAGSchema), (req, res, next) =>
  parentDocumentController.executeRAG(req, res, next)
);

router.post('/benchmark', validateRequest(BenchmarkRequestSchema), (req, res, next) =>
  parentDocumentController.benchmark(req, res, next)
);

export default router;
