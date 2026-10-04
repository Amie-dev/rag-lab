import { NextFunction, Request, Response } from 'express';
import { benchmarkService } from '../services/benchmark.service';
import { indexingService } from '../services/indexing.service';
import { parentDocumentRAGService } from '../services/parent-document-rag.service';
import { parentStoreService } from '../services/parent-store.service';
import { vectorStoreService } from '../services/vector-store.service';

/**
 * REST controller exposing the Parent-Document RAG engine.
 */
export class ParentDocumentController {
  /**
   * Performs retrieval + child→parent resolution (no generation).
   */
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await parentDocumentRAGService.search(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Executes end-to-end grounded Parent-Document RAG answering.
   */
  async executeRAG(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await parentDocumentRAGService.executeRAG(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Runs the comparative Standard-vs-Parent-Document benchmark suite.
   */
  async benchmark(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await benchmarkService.runBenchmark(req.body || {});
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ingests custom documents, building the parent/child hierarchy.
   */
  async ingest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documents, chunking } = req.body;
      const stats = await indexingService.ingestDocuments(documents, chunking || {});
      res.status(201).json({
        message: 'Documents ingested successfully.',
        ...stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lists a summary of the indexed child chunks.
   */
  async getDocuments(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const children = vectorStoreService.getChildren();
      res.status(200).json({
        totalParents: parentStoreService.size(),
        totalChildren: children.length,
        children: children.map((c) => ({
          id: c.id,
          parentId: c.parentId,
          documentId: c.documentId,
          title: c.metadata.title || 'Untitled',
          contentSnippet: c.content.slice(0, 100) + '...',
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lists the stored parent chunks (the generation-context layer).
   */
  async getParents(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parents = parentStoreService.getAllParents();
      res.status(200).json({
        totalParents: parents.length,
        parents: parents.map((p) => ({
          id: p.id,
          documentId: p.documentId,
          title: p.metadata.title || 'Untitled',
          parentIndex: p.parentIndex,
          childCount: p.childCount,
          tokenEstimate: p.tokenEstimate,
          contentSnippet: p.content.slice(0, 140) + '...',
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check & knowledge-base status.
   */
  async health(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        knowledgeBaseReady: indexingService.isReady(),
        totalParents: parentStoreService.size(),
        totalChildren: vectorStoreService.getChildren().length,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const parentDocumentController = new ParentDocumentController();
