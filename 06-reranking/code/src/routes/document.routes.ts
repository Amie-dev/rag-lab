import { Router } from 'express';
import { documentController } from '../controllers/document.controller';

const router = Router();

router.post('/ingest', (req, res, next) => documentController.ingestDocument(req, res, next));
router.post('/seed', (req, res, next) => documentController.seedDataset(req, res, next));
router.get('/', (req, res) => documentController.listDocuments(req, res));
router.delete('/', (req, res) => documentController.clearDocuments(req, res));

export default router;
