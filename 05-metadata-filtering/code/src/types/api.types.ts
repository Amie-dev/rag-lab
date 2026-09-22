/**
 * API Data Transfer Objects (DTOs) and Request Context Definitions
 */

import { MetadataFilter, RetrievalResult, SearchMode } from './filter.types';
import { ChunkMetadata } from './document.types';

export interface AuthenticatedUser {
  user_id: string;
  tenant_id: string;
  department?: string;
  departments?: string[];
  access_level: number;
  roles?: string[];
}

export interface IngestDocumentDTO {
  id?: string;
  content: string;
  metadata: {
    tenant_id: string;
    user_id?: string;
    department?: string;
    created_at?: string;
    file_type?: string;
    document_type?: string;
    language?: string;
    access_level?: number;
    project_id?: string;
    source?: string;
    is_public?: boolean;
    [key: string]: unknown;
  };
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface SearchQueryDTO {
  query: string;
  filter?: MetadataFilter;
  topK?: number;
  mode?: SearchMode;
  postFilterCandidateLimit?: number;
  bypassAuthGuard?: boolean; // Internal use only for testing/benchmark
}

export interface RAGQueryDTO {
  question: string;
  filter?: MetadataFilter;
  topK?: number;
  mode?: SearchMode;
  postFilterCandidateLimit?: number;
  systemPrompt?: string;
}

export interface RAGResponseDTO {
  question: string;
  answer: string;
  retrievedChunks: Array<{
    id: string;
    content: string;
    metadata: ChunkMetadata;
    score: number;
  }>;
  metadata: {
    searchMode: SearchMode;
    appliedFilter: MetadataFilter;
    candidatesEvaluated: number;
    chunksRetrievedCount: number;
    retrievalLatencyMs: number;
    generationLatencyMs: number;
    totalLatencyMs: number;
    provider: string;
  };
}

export interface BenchmarkQueryDTO {
  query: string;
  filter: MetadataFilter;
  topK?: number;
  postFilterCandidateLimits?: number[]; // e.g. [5, 10, 20, 50]
}

export interface BenchmarkComparisonResultDTO {
  query: string;
  filter: MetadataFilter;
  topK: number;
  preFilter: {
    retrievedCount: number;
    candidatesEvaluated: number;
    latencyMs: number;
    avgScore: number;
    returnedChunkIds: string[];
  };
  postFilterRuns: Array<{
    candidateLimit: number;
    retrievedCount: number;
    candidatesEvaluated: number;
    latencyMs: number;
    precisionVersusPreFilter: number;
    returnedChunkIds: string[];
    zeroResultOccurred: boolean;
  }>;
  analysis: {
    recommendation: string;
    candidateWasteRatio: number;
  };
}
