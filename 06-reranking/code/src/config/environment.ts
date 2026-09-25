import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env if available
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // OpenAI API
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  openaiCompletionModel: process.env.OPENAI_COMPLETION_MODEL || 'gpt-4o-mini',
  
  // Cohere Rerank API
  cohereApiKey: process.env.COHERE_API_KEY || '',
  cohereRerankModel: process.env.COHERE_RERANK_MODEL || 'rerank-v3.5',

  // Defaults
  defaultStage1TopN: parseInt(process.env.DEFAULT_STAGE1_CANDIDATE_TOP_N || '20', 10),
  defaultStage2TopK: parseInt(process.env.DEFAULT_STAGE2_FINAL_TOP_K || '5', 10),
  defaultRetrievalMode: process.env.DEFAULT_RETRIEVAL_MODE || 'hybrid',
};
