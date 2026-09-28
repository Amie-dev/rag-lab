import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiCompletionModel: process.env.OPENAI_COMPLETION_MODEL || 'gpt-4o-mini',
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  defaultNumGeneratedQueries: parseInt(process.env.DEFAULT_NUM_GENERATED_QUERIES || '4', 10),
  defaultTopKPerQuery: parseInt(process.env.DEFAULT_TOP_K_PER_QUERY || '5', 10),
  defaultFinalTopK: parseInt(process.env.DEFAULT_FINAL_TOP_K || '5', 10),
  defaultFusionStrategy: (process.env.DEFAULT_FUSION_STRATEGY || 'rrf') as 'rrf' | 'max_score' | 'avg_score',
};
