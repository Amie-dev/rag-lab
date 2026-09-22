/**
 * Application Configuration
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
  defaultTopK: parseInt(process.env.DEFAULT_TOP_K || '5', 10),
  defaultSearchMode: (process.env.DEFAULT_SEARCH_MODE || 'pre-filter') as 'pre-filter' | 'post-filter',
};
