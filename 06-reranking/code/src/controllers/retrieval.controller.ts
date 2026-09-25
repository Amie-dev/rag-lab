import { Request, Response, NextFunction } from 'express';
import { retrievalPipelineService } from '../services/retrieval-pipeline.service';
import { rerankerService } from '../services/reranker.service';
import { SearchQuerySchema, DirectRerankSchema, PipelineOptions, DocumentChunk } from '../types';

export class RetrievalController {
  /**
   * POST /api/v1/search
   * Executes Two-Stage Retrieval (Stage 1 candidate retrieval + Stage 2 reranking).
   */
  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = SearchQuerySchema.parse(req.body);

      const pipelineOpts: PipelineOptions = {
        stage1CandidateTopN: validated.stage1CandidateTopN,
        stage2FinalTopK: validated.stage2FinalTopK,
        retrievalMode: validated.retrievalMode,
        rerankerProvider: validated.rerankerProvider,
        hybridAlpha: validated.hybridAlpha,
      };

      const result = await retrievalPipelineService.executePipeline(validated.query, pipelineOpts);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/rerank
   * Reranks a direct payload list of candidate documents against a query.
   */
  async rerankDirect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = DirectRerankSchema.parse(req.body);

      const chunks: DocumentChunk[] = validated.documents.map((doc) => ({
        id: doc.id,
        content: doc.content,
        metadata: {
          title: doc.metadata?.title || doc.id,
          ...doc.metadata,
        },
      }));

      const startTime = Date.now();
      const scored = await rerankerService.rerank(validated.query, chunks, 'local');
      const latencyMs = Date.now() - startTime;

      scored.sort((a, b) => b.score - a.score);

      const results = scored.slice(0, validated.topK).map((item, idx) => ({
        id: item.chunk.id,
        content: item.chunk.content,
        metadata: item.chunk.metadata,
        score: item.score,
        rank: idx + 1,
        reasoning: item.reasoning,
      }));

      res.status(200).json({
        success: true,
        query: validated.query,
        latencyMs,
        count: results.length,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const retrievalController = new RetrievalController();
