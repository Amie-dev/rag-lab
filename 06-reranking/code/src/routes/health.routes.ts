import { Router } from 'express';
import { inMemoryVectorStore } from '../vectordb/in-memory-vector-store';
import { config } from '../config/environment';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: '@rag-lab/reranking-rag',
    timestamp: new Date().toISOString(),
    vectorStoreCount: inMemoryVectorStore.count(),
    providers: {
      openaiConfigured: Boolean(config.openaiApiKey),
      cohereConfigured: Boolean(config.cohereApiKey),
    },
  });
});

export default router;
