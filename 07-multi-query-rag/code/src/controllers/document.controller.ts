import { Request, Response, NextFunction } from 'express';
import { IngestDocumentSchema } from '../types';
import { vectorStoreService } from '../services/vector-store.service';
import fs from 'fs';
import path from 'path';

export class DocumentController {
  async ingest(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedInput = IngestDocumentSchema.parse(req.body);
      const chunk = await vectorStoreService.ingestDocument(validatedInput);
      return res.status(201).json({
        success: true,
        message: 'Document chunk successfully ingested',
        chunk,
        totalChunksInStore: vectorStoreService.getChunkCount(),
      });
    } catch (error) {
      next(error);
    }
  }

  async seed(req: Request, res: Response, next: NextFunction) {
    try {
      const samplePath = path.resolve(process.cwd(), 'sample_data/documents.json');
      if (!fs.existsSync(samplePath)) {
        return res.status(404).json({ success: false, error: 'Sample dataset file not found.' });
      }

      const rawData = fs.readFileSync(samplePath, 'utf-8');
      const documents = JSON.parse(rawData);
      const ingested = await vectorStoreService.bulkIngestDocuments(documents);

      return res.status(200).json({
        success: true,
        message: `Successfully seeded ${ingested.length} sample document chunks into vector database`,
        totalChunksInStore: vectorStoreService.getChunkCount(),
        ingestedIds: ingested.map((d) => d.id),
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const chunks = vectorStoreService.getAllChunks();
      return res.status(200).json({
        success: true,
        totalChunks: chunks.length,
        chunks: chunks.map((c) => ({
          id: c.id,
          metadata: c.metadata,
          contentSnippet: c.content.slice(0, 150) + '...',
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  async clear(req: Request, res: Response, next: NextFunction) {
    try {
      vectorStoreService.clear();
      return res.status(200).json({
        success: true,
        message: 'Vector store successfully cleared',
        totalChunksInStore: 0,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const documentController = new DocumentController();
