import { Router } from 'express';
import { vectorStoreService } from '../services/vector-store.service';
import { config } from '../config/environment';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: '@rag-lab/multi-query-rag',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    openaiConfigured: Boolean(config.openaiApiKey),
    vectorStoreChunks: vectorStoreService.getChunkCount(),
  });
});

export default router;
