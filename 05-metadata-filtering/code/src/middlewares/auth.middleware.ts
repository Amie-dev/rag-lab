/**
 * Authentication & Tenant Context Middleware
 * Extracts authenticated user context and tenant isolation parameters from headers.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser } from '../types/api.types';

// Extend Express Request type
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
