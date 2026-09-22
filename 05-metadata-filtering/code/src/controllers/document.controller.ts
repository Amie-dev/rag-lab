/**
 * Document Ingestion and Management Controller
 */

import { Request, Response, NextFunction } from 'express';
import { RAGService } from '../services/ragService';
import { z } from 'zod';

export const ingestDocumentSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1, 'Document content is required'),
  metadata: z.object({
    tenant_id: z.string().min(1, 'tenant_id is required in metadata'),
    user_id: z.string().optional(),
    department: z.string().optional(),
    created_at: z.string().optional(),
    file_type: z.string().optional(),
    document_type: z.string().optional(),
    language: z.string().optional(),
    access_level: z.number().optional(),
    project_id: z.string().optional(),
    source: z.string().optional(),
    is_public: z.boolean().optional(),
  }).passthrough(),
  chunkSize: z.number().positive().optional(),
  chunkOverlap: z.number().nonnegative().optional(),
});

export class DocumentController {
  private ragService: RAGService;

  constructor(ragService: RAGService) {
    this.ragService = ragService;
  }

  public ingest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.ragService.ingestDocument(req.body);
      res.status(201).json({
        message: 'Document successfully ingested and indexed',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  public deleteDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const deletedChunks = this.ragService.getVectorStore().deleteDocument(id);
      res.json({
        message: `Document ${id} deleted`,
        deletedChunks,
      });
    } catch (err) {
      next(err);
    }
  };
}
