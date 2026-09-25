import { Request, Response, NextFunction } from 'express';
import { retrievalPipelineService } from '../services/retrieval-pipeline.service';
import { llmService } from '../services/llm.service';
import { RAGQuerySchema, PipelineOptions } from '../types';

export class RAGController {
  /**
   * POST /api/v1/rag/query
   * Runs the complete Two-Stage Reranking RAG Pipeline and returns a grounded answer.
   */
  async queryRAG(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = RAGQuerySchema.parse(req.body);

      const pipelineOpts: PipelineOptions = {
        stage1CandidateTopN: validated.stage1CandidateTopN,
        stage2FinalTopK: validated.stage2FinalTopK,
        retrievalMode: validated.retrievalMode,
        rerankerProvider: validated.rerankerProvider,
        hybridAlpha: validated.hybridAlpha,
      };

      // 1. Retrieve & Rerank Context Chunks
      const pipelineResult = await retrievalPipelineService.executePipeline(validated.query, pipelineOpts);

      // 2. Synthesize Grounded Answer with Structured Output
      const answerResponse = await llmService.generateAnswer(
        validated.query,
        pipelineResult.rerankedResults
      );

      res.status(200).json({
        success: true,
        query: validated.query,
        answer: answerResponse.answer,
        confidenceScore: answerResponse.confidenceScore,
        citedChunkIds: answerResponse.citedChunkIds,
        keyInsights: answerResponse.keyInsights,
        retrievalMetrics: pipelineResult.metrics,
        contextChunks: pipelineResult.rerankedResults.map((r) => ({
          id: r.chunk.id,
          title: r.chunk.metadata.title,
          stage1Rank: r.stage1Rank,
          stage1Score: r.stage1Score,
          stage2Score: r.stage2Score,
          finalRank: r.finalRank,
          rankDelta: r.rankDelta,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
}

export const ragController = new RAGController();
