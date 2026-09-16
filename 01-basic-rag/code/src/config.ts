import { SimilarityMetric } from './schemas';

export interface RAGConfig {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityMetric: SimilarityMetric;
  embeddingProvider: 'mock' | 'openai' | 'gemini';
  llmProvider: 'mock' | 'openai' | 'gemini';
  openaiApiKey?: string;
  openaiEmbeddingModel?: string;
  openaiLlmModel?: string;
  geminiApiKey?: string;
  geminiEmbeddingModel?: string;
  geminiLlmModel?: string;
}

export const defaultConfig: RAGConfig = {
  chunkSize: 500,
  chunkOverlap: 50,
  topK: 3,
  similarityMetric: 'cosine',
  embeddingProvider: 'mock',
  llmProvider: 'mock',
  openaiEmbeddingModel: 'text-embedding-3-small',
  openaiLlmModel: 'gpt-4o-mini',
  geminiEmbeddingModel: 'models/embedding-001',
  geminiLlmModel: 'gemini-1.5-flash',
};

export function loadConfigFromEnv(): RAGConfig {
  return {
    ...defaultConfig,
    chunkSize: process.env.RAG_CHUNK_SIZE ? parseInt(process.env.RAG_CHUNK_SIZE, 10) : defaultConfig.chunkSize,
    chunkOverlap: process.env.RAG_CHUNK_OVERLAP ? parseInt(process.env.RAG_CHUNK_OVERLAP, 10) : defaultConfig.chunkOverlap,
    topK: process.env.RAG_TOP_K ? parseInt(process.env.RAG_TOP_K, 10) : defaultConfig.topK,
    similarityMetric: (process.env.RAG_SIMILARITY_METRIC as SimilarityMetric) || defaultConfig.similarityMetric,
    embeddingProvider: (process.env.RAG_EMBEDDING_PROVIDER as 'mock' | 'openai' | 'gemini') || defaultConfig.embeddingProvider,
    llmProvider: (process.env.RAG_LLM_PROVIDER as 'mock' | 'openai' | 'gemini') || defaultConfig.llmProvider,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || defaultConfig.openaiEmbeddingModel,
    openaiLlmModel: process.env.OPENAI_LLM_MODEL || defaultConfig.openaiLlmModel,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || defaultConfig.geminiEmbeddingModel,
    geminiLlmModel: process.env.GEMINI_LLM_MODEL || defaultConfig.geminiLlmModel,
  };
}
