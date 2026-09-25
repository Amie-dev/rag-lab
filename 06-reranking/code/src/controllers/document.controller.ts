import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { inMemoryVectorStore } from '../vectordb/in-memory-vector-store';
import { embeddingService } from '../services/embedding.service';
import { IngestDocumentSchema, DocumentChunk } from '../types';

export class DocumentController {
  /**
   * POST /api/v1/documents/ingest
   */
  async ingestDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = IngestDocumentSchema.parse(req.body);
      const id = validatedData.id || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const embedding = await embeddingService.generateEmbedding(
        `${validatedData.metadata.title} ${validatedData.content}`
      );

      const chunk: DocumentChunk = {
        id,
        content: validatedData.content,
        metadata: validatedData.metadata,
        embedding,
      };

      inMemoryVectorStore.upsertChunk(chunk);

      res.status(201).json({
        success: true,
        message: 'Document ingested successfully',
        data: {
          id: chunk.id,
          title: chunk.metadata.title,
          embeddingDimension: embedding.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/documents/seed
   */
  async seedDataset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const samplePath = path.resolve(__dirname, '../../sample_data/documents.json');
      if (!fs.existsSync(samplePath)) {
        res.status(404).json({ success: false, error: 'Sample dataset file not found' });
        return;
      }

      const fileData = fs.readFileSync(samplePath, 'utf-8');
      const rawChunks: Array<{ id: string; content: string; metadata: any }> = JSON.parse(fileData);

      const chunksWithEmbeddings: DocumentChunk[] = [];
      for (const item of rawChunks) {
        const textToEmbed = `${item.metadata?.title || ''} ${item.content}`;
        const embedding = await embeddingService.generateEmbedding(textToEmbed);
        chunksWithEmbeddings.push({
          id: item.id,
          content: item.content,
          metadata: item.metadata || {},
          embedding,
        });
      }

      inMemoryVectorStore.upsertChunks(chunksWithEmbeddings);

      res.status(200).json({
        success: true,
        message: `Successfully seeded ${chunksWithEmbeddings.length} document chunks into Vector Store`,
        data: {
          totalDocuments: inMemoryVectorStore.count(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/documents
   */
  listDocuments(req: Request, res: Response): void {
    const chunks = inMemoryVectorStore.getAllChunks().map((c) => ({
      id: c.id,
      title: c.metadata.title,
      category: c.metadata.category,
      contentSnippet: c.content.substring(0, 100) + '...',
      hasEmbedding: Boolean(c.embedding),
    }));

    res.status(200).json({
      success: true,
      count: chunks.length,
      data: chunks,
    });
  }

  /**
   * DELETE /api/v1/documents
   */
  clearDocuments(req: Request, res: Response): void {
    inMemoryVectorStore.clear();
    res.status(200).json({
      success: true,
      message: 'Vector store cleared successfully',
    });
  }
}

export const documentController = new DocumentController();
