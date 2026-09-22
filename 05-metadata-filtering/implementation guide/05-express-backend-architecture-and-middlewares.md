# 🌐 Chapter 5 — Express Backend Architecture & Middlewares

Welcome to Chapter 5 of the **Metadata-Filtered RAG Implementation Guide**. In this chapter, we explore the Express HTTP web application architecture, middleware setup, request validation with Zod, and error handling mechanisms.

Source code modules:
- [`05-metadata-filtering/code/src/app.ts`](../code/src/app.ts)
- [`05-metadata-filtering/code/src/server.ts`](../code/src/server.ts)
- [`05-metadata-filtering/code/src/middlewares/auth.middleware.ts`](../code/src/middlewares/auth.middleware.ts)
- [`05-metadata-filtering/code/src/middlewares/error.middleware.ts`](../code/src/middlewares/error.middleware.ts)
- [`05-metadata-filtering/code/src/middlewares/validate.middleware.ts`](../code/src/middlewares/validate.middleware.ts)

---

## 1. Authentication & Context Middleware

File: [`05-metadata-filtering/code/src/middlewares/auth.middleware.ts`](../code/src/middlewares/auth.middleware.ts)

```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser } from '../types/api.types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const tenantId = (req.headers['x-tenant-id'] as string) || 'tenant_101';
  const userId = (req.headers['x-user-id'] as string) || 'user_demo_123';
  const department = (req.headers['x-department'] as string) || 'finance';
  const accessLevelHeader = req.headers['x-access-level'] as string;
  const accessLevel = accessLevelHeader ? parseInt(accessLevelHeader, 10) : 3;

  const rawDepts = (req.headers['x-departments'] as string) || department;
  const departments = rawDepts ? rawDepts.split(',').map((d) => d.trim()) : [department];

  req.user = {
    tenant_id: tenantId,
    user_id: userId,
    department,
    departments,
    access_level: isNaN(accessLevel) ? 3 : accessLevel,
  };

  next();
}
```

---

## 2. Request Payload Validation Middleware (Zod)

File: [`05-metadata-filtering/code/src/middlewares/validate.middleware.ts`](../code/src/middlewares/validate.middleware.ts)

```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: {
            message: 'Validation failed',
            details: error.errors,
            statusCode: 400,
          },
        });
        return;
      }
      next(error);
    }
  };
}
```

---

## 3. Centralized Error Handler

File: [`05-metadata-filtering/code/src/middlewares/error.middleware.ts`](../code/src/middlewares/error.middleware.ts)

```typescript
import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('API Error:', err);

  const statusCode = (err as unknown as { status?: number }).status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
    },
  });
}
```

---

## 4. Express Application Initialization

File: [`05-metadata-filtering/code/src/app.ts`](../code/src/app.ts)

```typescript
import express, { Express } from 'express';
import cors from 'cors';
import { RAGService } from './services/ragService';
import { BenchmarkService } from './services/benchmarkService';
import { authMiddleware } from './middlewares/auth.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { createApiRouter } from './routes/index';

export function createApp(
  ragService?: RAGService,
  benchmarkService?: BenchmarkService
): Express {
  const app = express();

  const activeRagService = ragService || new RAGService();
  const activeBenchmarkService = benchmarkService || new BenchmarkService(activeRagService);

  app.use(cors());
  app.use(express.json());
  app.use(authMiddleware);

  app.use('/api/v1', createApiRouter(activeRagService, activeBenchmarkService));

  app.use(errorMiddleware);

  return app;
}
```
