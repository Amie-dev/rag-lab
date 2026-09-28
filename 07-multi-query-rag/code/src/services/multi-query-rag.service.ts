import {
  MultiQueryRAGRequest,
  MultiQueryRAGResponse,
  MultiQuerySearchRequest,
  MultiQuerySearchResponse,
} from '../types';
import { multiQueryGeneratorService } from './multi-query-generator.service';
import { resultMergerService } from './result-merger.service';
import { rerankerService } from './reranker.service';
import { llmService } from './llm.service';

export class MultiQueryRAGService {
  /**
   * Executes Multi-Query Search and Candidate Retrieval (without final LLM answer synthesis).
   */
  async search(request: MultiQuerySearchRequest): Promise<MultiQuerySearchResponse> {
    const numQueries = request.numQueries ?? 4;
    const topKPerQuery = request.topKPerQuery ?? 5;
    const finalTopK = request.finalTopK ?? 5;
    const fusionStrategy = request.fusionStrategy ?? 'rrf';
    const retrievalMode = request.retrievalMode ?? 'hybrid';
    const enableReranking = request.enableReranking ?? true;

    // 1. Generate query variations
    const generatedQueries = await multiQueryGeneratorService.generateQueryVariations(
      request.query,
      numQueries
    );

    // 2. Retrieve per query and merge/deduplicate
    const mergeResult = await resultMergerService.retrieveAndMerge(
      generatedQueries,
      topKPerQuery,
      retrievalMode,
      fusionStrategy
    );

    // 3. Optional Reranking
    let topContextChunks = mergeResult.mergedCandidates;
    if (enableReranking) {
      topContextChunks = await rerankerService.rerankCandidates(
        request.query,
        mergeResult.mergedCandidates,
        finalTopK
      );
    } else {
      topContextChunks = mergeResult.mergedCandidates.slice(0, finalTopK);
    }

    return {
      originalQuery: request.query,
      generatedQueries,
      totalCandidatesRetrieved: mergeResult.totalCandidatesRetrieved,
      uniqueCandidatesDeduplicated: mergeResult.uniqueCandidatesDeduplicated,
      fusionStrategy,
      mergedResults: mergeResult.mergedCandidates,
      topContextChunks,
    };
  }

  /**
   * Complete End-to-End Multi-Query RAG Pipeline execution.
   */
  async executeRAG(request: MultiQueryRAGRequest): Promise<MultiQueryRAGResponse> {
    const searchResponse = await this.search({
      query: request.question,
      numQueries: request.numQueries,
      topKPerQuery: request.topKPerQuery,
      finalTopK: request.finalTopK,
      fusionStrategy: request.fusionStrategy,
      enableReranking: request.enableReranking,
      retrievalMode: request.retrievalMode,
    });

    // Synthesize grounded answer
    const llmAnswer = await llmService.generateAnswer(
      request.question,
      searchResponse.generatedQueries,
      searchResponse.topContextChunks
    );

    return {
      question: request.question,
      generatedQueries: searchResponse.generatedQueries,
      answer: llmAnswer.answer,
      confidenceScore: llmAnswer.confidenceScore,
      citedChunkIds: llmAnswer.citedChunkIds,
      keyInsights: llmAnswer.keyInsights,
      retrievalSummary: {
        totalRetrieved: searchResponse.totalCandidatesRetrieved,
        uniqueDeduplicated: searchResponse.uniqueCandidatesDeduplicated,
        finalContextCount: searchResponse.topContextChunks.length,
        fusionStrategy: searchResponse.fusionStrategy,
      },
      retrievedContext: searchResponse.topContextChunks,
    };
  }
}

export const multiQueryRAGService = new MultiQueryRAGService();
