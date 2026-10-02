import { Request, Response, NextFunction } from 'express';
import { benchmarkService } from '../services/benchmark.service';
import { hydeGeneratorService } from '../services/hyde-generator.service';
import { hydeRAGService } from '../services/hyde-rag.service';
import { vectorStoreService } from '../services/vector-store.service';
import { Document } from '../types';

export class HyDEController {
  /**
   * Generates hypothetical document passage(s) preview.
   */
  async generateHypothetical(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, numDocs, domainContext } = req.body;
      const docs = await hydeGeneratorService.generateHypotheticalDocuments(query, numDocs, domainContext);
      res.status(200).json({
        query,
        numDocs: docs.length,
        domainContext,
        hypotheticalDocuments: docs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Performs candidate chunk retrieval using HyDE vector + BM25 search.
   */
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const searchResult = await hydeRAGService.search(req.body);
      res.status(200).json(searchResult);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Executes end-to-end grounded HyDE RAG query answering.
   */
  async executeRAG(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ragResult = await hydeRAGService.executeRAG(req.body);
      res.status(200).json(ragResult);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Evaluates comparative retrieval benchmarks across strategies.
   */
  async benchmark(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const benchmarkResult = await benchmarkService.runBenchmark(req.body || {});
      res.status(200).json(benchmarkResult);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Ingests custom documents into the vector store.
   */
  async ingest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documents } = req.body as { documents: Document[] };
      if (!Array.isArray(documents) || documents.length === 0) {
        res.status(400).json({ error: 'Body must contain non-empty "documents" array.' });
        return;
      }
      const chunkCount = await vectorStoreService.ingestDocuments(documents);
      res.status(201).json({
        message: 'Documents ingested successfully.',
        documentsIngested: documents.length,
        totalChunksCreated: chunkCount,
        totalChunksInStore: vectorStoreService.getChunks().length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves summary of stored documents & chunks.
   */
  async getDocuments(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const chunks = vectorStoreService.getChunks();
      res.status(200).json({
        totalChunks: chunks.length,
        chunks: chunks.map((c) => ({
          id: c.id,
          documentId: c.documentId,
          title: c.metadata.title || 'Untitled',
          category: c.metadata.category || 'General',
          contentSnippet: c.content.slice(0, 100) + '...',
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Health check status endpoint.
   */
  async health(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        vectorStoreReady: vectorStoreService.isReady(),
        totalChunks: vectorStoreService.getChunks().length,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const hydeController = new HyDEController();
