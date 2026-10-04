import { config } from '../config/environment';
import {
  ParentDocumentRAGRequest,
  ParentDocumentRAGResponse,
  ParentDocumentSearchRequest,
  ParentDocumentSearchResponse,
} from '../types';
import { embeddingService } from './embedding.service';
import { llmService } from './llm.service';
import { parentResolverService } from './parent-resolver.service';
import { rerankerService } from './reranker.service';
import { resultMergerService } from './result-merger.service';

/**
 * ParentDocumentRAGService is the top-level orchestrator implementing the
 * canonical Parent-Document retrieval pipeline:
 *
 *   Query
 *     ↓
 *   Embed Query
 *     ↓
 *   Retrieve CHILD candidates (dense + BM25 sparse, fused)
 *     ↓
 *   Optional child reranking
 *     ↓
 *   Resolve CHILD → PARENT (dedup + context budget)
 *     ↓
 *   Generate from PARENT context (LLM)
 */
export class ParentDocumentRAGService {
  /**
   * Executes the retrieval + parent-resolution pipeline (no generation).
   */
  async search(request: ParentDocumentSearchRequest): Promise<ParentDocumentSearchResponse> {
    const startTime = Date.now();

    const childTopK = request.childTopK ?? config.defaultChildTopK;
    const finalChildTopK = request.finalChildTopK ?? config.defaultFinalChildTopK;
    const maxParents = request.maxParents ?? config.defaultMaxParents;
    const maxContextTokens = request.maxContextTokens ?? config.defaultMaxContextTokens;
    const fusionStrategy = request.fusionStrategy ?? 'rrf';
    const retrievalMode = request.retrievalMode ?? 'hybrid';
    const enableReranking = request.enableReranking ?? config.defaultEnableReranking;
    const scoreAggregation = request.scoreAggregation ?? 'mean_child';

    // 1. Embed the query once.
    const queryVector = await embeddingService.getEmbedding(request.query);

    // 2. Retrieve & fuse CHILD candidates (small retrieval units).
    const mergeResult = resultMergerService.retrieveChildren(
      queryVector,
      request.query,
      childTopK,
      retrievalMode,
      fusionStrategy
    );

    // 3. Optionally rerank child candidates against the original query.
    let topChildCandidates = mergeResult.mergedCandidates;
    if (enableReranking) {
      topChildCandidates = await rerankerService.rerankChildCandidates(
        request.query,
        mergeResult.mergedCandidates,
        finalChildTopK
      );
    } else {
      topChildCandidates = mergeResult.mergedCandidates.slice(0, finalChildTopK);
    }

    // 4. Resolve CHILD → PARENT (dedup + context budget).
    const resolution = parentResolverService.resolve(topChildCandidates, {
      maxParents,
      maxContextTokens,
      scoreAggregation,
    });

    const executionTimeMs = Date.now() - startTime;

    return {
      query: request.query,
      totalChildCandidatesRetrieved: mergeResult.totalCandidatesRetrieved,
      uniqueChildrenDeduplicated: mergeResult.uniqueCandidatesDeduplicated,
      fusionStrategy,
      retrievalMode,
      childCandidates: mergeResult.mergedCandidates,
      topChildCandidates,
      resolution,
      executionTimeMs,
    };
  }

  /**
   * Executes the complete end-to-end Parent-Document RAG pipeline, generating a
   * grounded answer from the resolved parent context.
   */
  async executeRAG(request: ParentDocumentRAGRequest): Promise<ParentDocumentRAGResponse> {
    const startTime = Date.now();

    const searchResponse = await this.search({
      query: request.question,
      childTopK: request.childTopK,
      finalChildTopK: request.finalChildTopK,
      maxParents: request.maxParents,
      maxContextTokens: request.maxContextTokens,
      fusionStrategy: request.fusionStrategy,
      retrievalMode: request.retrievalMode,
      enableReranking: request.enableReranking,
      scoreAggregation: request.scoreAggregation,
    });

    const parentContexts = searchResponse.resolution.parentContexts;

    // Generate strictly from the resolved PARENT contexts.
    const groundedAnswer = await llmService.generateGroundedAnswer(request.question, parentContexts);

    const executionTimeMs = Date.now() - startTime;

    return {
      question: request.question,
      answer: groundedAnswer.answer,
      confidenceScore: groundedAnswer.confidenceScore,
      citedParentIds: groundedAnswer.citedParentIds,
      keyInsights: groundedAnswer.keyInsights,
      retrievalSummary: {
        totalChildCandidates: searchResponse.totalChildCandidatesRetrieved,
        uniqueChildren: searchResponse.uniqueChildrenDeduplicated,
        finalChildCandidates: searchResponse.topChildCandidates.length,
        parentContextsResolved: parentContexts.length,
        totalContextTokens: searchResponse.resolution.totalContextTokens,
        fusionStrategy: searchResponse.fusionStrategy,
        rerankingApplied: request.enableReranking ?? config.defaultEnableReranking,
        budgetExceeded: searchResponse.resolution.budgetExceeded,
      },
      childEvidence: searchResponse.topChildCandidates,
      parentContexts,
      executionTimeMs,
    };
  }
}

export const parentDocumentRAGService = new ParentDocumentRAGService();
