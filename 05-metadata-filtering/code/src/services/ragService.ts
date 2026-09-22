/**
 * Core Metadata-Filtered RAG Service Engine
 */

import { Chunk, Document, DocumentMetadata, VectorRecord } from '../types/document.types';
import { MetadataFilter, RetrievalResult, SearchMode } from '../types/filter.types';
import { AuthenticatedUser, IngestDocumentDTO, RAGQueryDTO, RAGResponseDTO, SearchQueryDTO } from '../types/api.types';
import { MemoryVectorStore } from '../vectordb/memoryVectorStore';
import { EmbeddingService } from './embeddingService';
import { LLMService } from './llmService';
import { SecurityFilterBuilder } from '../filters/securityFilter';

export class RAGService {
  private vectorStore: MemoryVectorStore;
  private embeddingService: EmbeddingService;
  private llmService: LLMService;

  constructor(
    vectorStore?: MemoryVectorStore,
    embeddingService?: EmbeddingService,
    llmService?: LLMService
  ) {
    this.vectorStore = vectorStore || new MemoryVectorStore();
    this.embeddingService = embeddingService || new EmbeddingService();
    this.llmService = llmService || new LLMService();
  }

  public getVectorStore(): MemoryVectorStore {
    return this.vectorStore;
  }

  /**
   * Ingests a raw document: chunks it, generates embeddings, binds metadata, and stores in Vector DB.
   */
  public async ingestDocument(dto: IngestDocumentDTO): Promise<{
    documentId: string;
    chunksCreated: number;
  }> {
    const documentId = dto.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const chunkSize = dto.chunkSize || 500;
    const chunkOverlap = dto.chunkOverlap || 50;

    // Simple fixed-character sliding window chunking with word boundary respect
    const rawChunksText = this.chunkText(dto.content, chunkSize, chunkOverlap);
    const records: VectorRecord[] = [];

    for (let i = 0; i < rawChunksText.length; i++) {
      const chunkText = rawChunksText[i];
      const chunkId = `${documentId}_chunk_${i}`;

      const chunkMetadata: Chunk['metadata'] = {
        ...dto.metadata,
        document_id: documentId,
        chunk_index: i,
        total_chunks: rawChunksText.length,
      };

      const chunk: Chunk = {
        id: chunkId,
        content: chunkText,
        metadata: chunkMetadata,
      };

      const vector = await this.embeddingService.getEmbedding(chunkText);

      records.push({
        id: chunkId,
        vector,
        chunk,
        metadata: chunkMetadata,
      });
    }

    this.vectorStore.addRecords(records);

    return {
      documentId,
      chunksCreated: records.length,
    };
  }

  /**
   * Executes a Metadata-Filtered Vector Similarity Search
   */
  public async search(
    queryDto: SearchQueryDTO,
    user?: AuthenticatedUser
  ): Promise<{
    results: RetrievalResult[];
    appliedFilter: MetadataFilter;
    candidatesEvaluated: number;
    searchMode: SearchMode;
    latencyMs: number;
  }> {
    const startTime = Date.now();

    // Determine final security-enforced metadata filter
    let finalFilter: MetadataFilter = queryDto.filter || {};
    if (user && !queryDto.bypassAuthGuard) {
      finalFilter = SecurityFilterBuilder.buildAuthorizedFilter(user, queryDto.filter);
    }

    const queryVector = await this.embeddingService.getEmbedding(queryDto.query);

    const searchOutput = this.vectorStore.search(queryVector, finalFilter, {
      topK: queryDto.topK || 5,
      mode: queryDto.mode || 'pre-filter',
      postFilterCandidateLimit: queryDto.postFilterCandidateLimit || 10,
    });

    const latencyMs = Date.now() - startTime;

    return {
      results: searchOutput.results,
      appliedFilter: finalFilter,
      candidatesEvaluated: searchOutput.candidatesEvaluated,
      searchMode: searchOutput.mode,
      latencyMs,
    };
  }

  /**
   * Full Metadata-Filtered RAG Pipeline: (Retrieval -> Context Augmentation -> LLM Answer)
   */
  public async executeRAG(
    ragDto: RAGQueryDTO,
    user: AuthenticatedUser
  ): Promise<RAGResponseDTO> {
    const startTime = Date.now();

    // 1. Search vector DB under metadata constraints
    const searchResponse = await this.search(
      {
        query: ragDto.question,
        filter: ragDto.filter,
        topK: ragDto.topK || 5,
        mode: ragDto.mode || 'pre-filter',
        postFilterCandidateLimit: ragDto.postFilterCandidateLimit || 10,
      },
      user
    );

    const retrievalLatencyMs = searchResponse.latencyMs;
    const retrievedChunks = searchResponse.results.map((r) => r.chunk);

    // 2. Generate LLM Answer
    const genStartTime = Date.now();
    const llmResult = await this.llmService.generateAnswer(
      ragDto.question,
      retrievedChunks,
      ragDto.systemPrompt
    );
    const generationLatencyMs = Date.now() - genStartTime;

    const totalLatencyMs = Date.now() - startTime;

    return {
      question: ragDto.question,
      answer: llmResult.answer,
      retrievedChunks: searchResponse.results.map((r) => ({
        id: r.chunk.id,
        content: r.chunk.content,
        metadata: r.chunk.metadata,
        score: r.score,
      })),
      metadata: {
        searchMode: searchResponse.searchMode,
        appliedFilter: searchResponse.appliedFilter,
        candidatesEvaluated: searchResponse.candidatesEvaluated,
        chunksRetrievedCount: searchResponse.results.length,
        retrievalLatencyMs,
        generationLatencyMs,
        totalLatencyMs,
        provider: llmResult.provider,
      },
    };
  }

  /**
   * Utility for text chunking
   */
  private chunkText(text: string, chunkSize: number, overlap: number): string[] {
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;
      if (end >= text.length) {
        chunks.push(text.substring(start).trim());
        break;
      }

      // Try to find natural word boundary
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start) {
        end = lastSpace;
      }

      chunks.push(text.substring(start, end).trim());
      start = end - overlap;
    }

    return chunks;
  }
}
