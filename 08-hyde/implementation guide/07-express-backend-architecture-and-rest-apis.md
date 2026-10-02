# Chapter 7 — Express Backend Architecture & REST APIs

## 🌐 1. Express Application Factory & Bootstrapping

The backend infrastructure is split into clean architectural layers:
- `app.ts`: Express application setup & dataset auto-ingestion.
- `server.ts`: HTTP server initialization.
- `controllers/hyde.controller.ts`: Controller handlers.
- `routes/hyde.routes.ts`: Route declarations.
- `middlewares/`: Request validation & global error handling.

### Application Factory (`src/app.ts`)

```typescript
import cors from 'cors';
import express, { Express } from 'express';
import fs from 'fs';
import path from 'path';
import { errorHandler } from './middlewares/error.middleware';
import hydeRoutes from './routes/hyde.routes';
import { vectorStoreService } from './services/vector-store.service';
import { Document } from './types';

export const createApp = async (): Promise<Express> => {
  const app: Express = express();

  app.use(cors());
  app.use(express.json());

  // Mount API routes
  app.use('/api/v1/hyde', hydeRoutes);

  // Global Error Handler
  app.use(errorHandler);

  // Auto-ingest sample dataset on boot if store empty
  await initializeSampleData();

  return app;
};

export const initializeSampleData = async (): Promise<void> => {
  if (vectorStoreService.isReady()) return;

  const samplePath = path.resolve(__dirname, '../sample_data/documents.json');
  if (fs.existsSync(samplePath)) {
    try {
      const fileData = fs.readFileSync(samplePath, 'utf-8');
      const docs: Document[] = JSON.parse(fileData);
      const chunkCount = await vectorStoreService.ingestDocuments(docs);
      console.log(`✅ Loaded ${docs.length} sample documents (${chunkCount} vector chunks) into memory.`);
    } catch (error) {
      console.warn('⚠️ Failed to load sample documents JSON:', error);
    }
  }
};
```

---

## 🔌 2. Middleware Implementation

### Zod Validation Middleware (`src/middlewares/validation.middleware.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

### Global Error Middleware (`src/middlewares/error.middleware.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('❌ Error caught by global error middleware:', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.',
  });
};
```

---

## ⚡ 3. Controller & Route Declarations

### HyDE Controller (`src/controllers/hyde.controller.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import { benchmarkService } from '../services/benchmark.service';
import { hydeGeneratorService } from '../services/hyde-generator.service';
import { hydeRAGService } from '../services/hyde-rag.service';
import { vectorStoreService } from '../services/vector-store.service';

export class HyDEController {
  async generateHypothetical(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, numDocs, domainContext } = req.body;
      const docs = await hydeGeneratorService.generateHypotheticalDocuments(query, numDocs, domainContext);
      res.status(200).json({ query, numDocs: docs.length, domainContext, hypotheticalDocuments: docs });
    } catch (error) { next(error); }
  }

  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const searchResult = await hydeRAGService.search(req.body);
      res.status(200).json(searchResult);
    } catch (error) { next(error); }
  }

  async executeRAG(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ragResult = await hydeRAGService.executeRAG(req.body);
      res.status(200).json(ragResult);
    } catch (error) { next(error); }
  }

  async benchmark(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const benchmarkResult = await benchmarkService.runBenchmark(req.body || {});
      res.status(200).json(benchmarkResult);
    } catch (error) { next(error); }
  }
}

export const hydeController = new HyDEController();
```

Next, proceed to **[Chapter 8 — Benchmarking, Interactive CLI & Test Suite](./08-benchmarking-cli-and-testing-suite.md)**.
