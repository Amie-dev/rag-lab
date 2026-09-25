import { embeddingService } from './embedding.service';
import { rerankerService } from './reranker.service';
import { inMemoryVectorStore } from '../vectordb/in-memory-vector-store';
import {
  CandidateResult,
  PipelineExecutionResult,
  PipelineOptions,
  RerankedResult,
} from '../types';

export class RetrievalPipelineService {
  /**
   * Executes the full Two-Stage Retrieval & Reranking Pipeline.
   *
   * Stage 1: Fast Candidate Retrieval (Vector / BM25 / Hybrid) -> High Recall
   * Stage 2: Cross-Encoder Reranking -> High Precision
   */
  async executePipeline(
    query: string,
    options: PipelineOptions
  ): Promise<PipelineExecutionResult> {
    const startTimeTotal = Date.now();

    // 1. Generate query embedding for Stage 1 dense vector similarity
    const startTimeStage1 = Date.now();
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // 2. Stage 1: Candidate Retrieval
    const rawCandidates = inMemoryVectorStore.search(
      query,
      queryEmbedding,
      options.retrievalMode,
      options.stage1CandidateTopN,
      options.hybridAlpha ?? 0.5
    );

    const stage1Candidates: CandidateResult[] = rawCandidates.map((cand) => ({
      chunk: cand.chunk,
      stage1Score: cand.stage1Score,
      stage1Rank: cand.stage1Rank,
      retrievalMethod: cand.retrievalMethod,
    }));

    const stage1LatencyMs = Date.now() - startTimeStage1;

    if (stage1Candidates.length === 0) {
      return {
        query,
        options,
        candidates: [],
        rerankedResults: [],
        metrics: {
          stage1LatencyMs,
          stage2LatencyMs: 0,
          totalLatencyMs: Date.now() - startTimeTotal,
          candidateCount: 0,
          finalCount: 0,
          topRankShift: false,
        },
      };
    }

    // 3. Stage 2: Reranking
    const startTimeStage2 = Date.now();
    const candidateChunks = stage1Candidates.map((c) => c.chunk);

    const scoredCandidates = await rerankerService.rerank(
      query,
      candidateChunks,
      options.rerankerProvider
    );

    const stage2LatencyMs = Date.now() - startTimeStage2;

    // Combine Stage 1 metrics with Stage 2 scores
    const stage1Map = new Map<string, CandidateResult>();
    for (const cand of stage1Candidates) {
      stage1Map.set(cand.chunk.id, cand);
    }

    const unrankedResults: Omit<RerankedResult, 'finalRank' | 'rankDelta'>[] =
      scoredCandidates.map((sc) => {
        const stage1Info = stage1Map.get(sc.chunk.id);
        return {
          chunk: sc.chunk,
          stage1Score: stage1Info?.stage1Score || 0,
          stage1Rank: stage1Info?.stage1Rank || 999,
          stage2Score: sc.score,
          reasoning: sc.reasoning,
          retrievalMethod: stage1Info?.retrievalMethod || options.retrievalMode,
        };
      });

    // Sort by Stage 2 Cross-Encoder Score descending
    unrankedResults.sort((a, b) => b.stage2Score - a.stage2Score);

    // Assign final ranks and compute rank delta (stage1Rank - finalRank)
    const allReranked: RerankedResult[] = unrankedResults.map((item, idx) => {
      const finalRank = idx + 1;
      const rankDelta = item.stage1Rank - finalRank;
      return {
        ...item,
        finalRank,
        rankDelta,
      };
    });

    // Truncate to final top-K requested
    const finalReranked = allReranked.slice(0, options.stage2FinalTopK);

    // Check if the #1 ranked document changed after reranking
    const topRankShift =
      stage1Candidates.length > 0 &&
      finalReranked.length > 0 &&
      stage1Candidates[0].chunk.id !== finalReranked[0].chunk.id;

    const totalLatencyMs = Date.now() - startTimeTotal;

    return {
      query,
      options,
      candidates: stage1Candidates,
      rerankedResults: finalReranked,
      metrics: {
        stage1LatencyMs,
        stage2LatencyMs,
        totalLatencyMs,
        candidateCount: stage1Candidates.length,
        finalCount: finalReranked.length,
        topRankShift,
      },
    };
  }
}

export const retrievalPipelineService = new RetrievalPipelineService();
