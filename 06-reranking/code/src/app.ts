import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes';
import documentRoutes from './routes/document.routes';
import retrievalRoutes from './routes/retrieval.routes';
import ragRoutes from './routes/rag.routes';
import benchmarkRoutes from './routes/benchmark.routes';
import { requestLogger } from './middlewares/request-logger.middleware';
import { errorHandler } from './middlewares/error.middleware';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// API Routes
app.use('/api/v1', healthRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1', retrievalRoutes);
app.use('/api/v1/rag', ragRoutes);
app.use('/api/v1/benchmark', benchmarkRoutes);

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global Error Middleware
app.use(errorHandler);
