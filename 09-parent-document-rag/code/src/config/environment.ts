import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const toInt = (val: string) => parseInt(val, 10);
const toBool = (val: string) => val === 'true';

const environmentSchema = z.object({
  PORT: z.string().transform(toInt).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_COMPLETION_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  DEFAULT_PARENT_CHUNK_SIZE: z.string().transform(toInt).default('1500'),
  DEFAULT_PARENT_CHUNK_OVERLAP: z.string().transform(toInt).default('200'),
  DEFAULT_CHILD_CHUNK_SIZE: z.string().transform(toInt).default('350'),
  DEFAULT_CHILD_CHUNK_OVERLAP: z.string().transform(toInt).default('60'),
  DEFAULT_CHILD_TOP_K: z.string().transform(toInt).default('12'),
  DEFAULT_FINAL_CHILD_TOP_K: z.string().transform(toInt).default('8'),
  DEFAULT_MAX_PARENTS: z.string().transform(toInt).default('4'),
  DEFAULT_MAX_CONTEXT_TOKENS: z.string().transform(toInt).default('3000'),
  DEFAULT_ENABLE_RERANKING: z.string().transform(toBool).default('true'),
});

const parseEnv = () => {
  const result = environmentSchema.safeParse(process.env);
  if (!result.success) {
    console.warn('⚠️ Environment configuration warnings:', result.error.format());
    return {
      PORT: toInt(process.env.PORT || '3000'),
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_COMPLETION_MODEL: process.env.OPENAI_COMPLETION_MODEL || 'gpt-4o-mini',
      OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      DEFAULT_PARENT_CHUNK_SIZE: toInt(process.env.DEFAULT_PARENT_CHUNK_SIZE || '1500'),
      DEFAULT_PARENT_CHUNK_OVERLAP: toInt(process.env.DEFAULT_PARENT_CHUNK_OVERLAP || '200'),
      DEFAULT_CHILD_CHUNK_SIZE: toInt(process.env.DEFAULT_CHILD_CHUNK_SIZE || '350'),
      DEFAULT_CHILD_CHUNK_OVERLAP: toInt(process.env.DEFAULT_CHILD_CHUNK_OVERLAP || '60'),
      DEFAULT_CHILD_TOP_K: toInt(process.env.DEFAULT_CHILD_TOP_K || '12'),
      DEFAULT_FINAL_CHILD_TOP_K: toInt(process.env.DEFAULT_FINAL_CHILD_TOP_K || '8'),
      DEFAULT_MAX_PARENTS: toInt(process.env.DEFAULT_MAX_PARENTS || '4'),
      DEFAULT_MAX_CONTEXT_TOKENS: toInt(process.env.DEFAULT_MAX_CONTEXT_TOKENS || '3000'),
      DEFAULT_ENABLE_RERANKING: process.env.DEFAULT_ENABLE_RERANKING !== 'false',
    };
  }
  return result.data;
};

const parsedConfig = parseEnv();

export const config = {
  port: parsedConfig.PORT,
  nodeEnv: parsedConfig.NODE_ENV,
  openaiApiKey: parsedConfig.OPENAI_API_KEY,
  openaiCompletionModel: parsedConfig.OPENAI_COMPLETION_MODEL,
  openaiEmbeddingModel: parsedConfig.OPENAI_EMBEDDING_MODEL,

  // Default hierarchical chunking configuration (character-based sizes)
  defaultParentChunkSize: parsedConfig.DEFAULT_PARENT_CHUNK_SIZE,
  defaultParentChunkOverlap: parsedConfig.DEFAULT_PARENT_CHUNK_OVERLAP,
  defaultChildChunkSize: parsedConfig.DEFAULT_CHILD_CHUNK_SIZE,
  defaultChildChunkOverlap: parsedConfig.DEFAULT_CHILD_CHUNK_OVERLAP,

  // Default retrieval / resolution configuration
  defaultChildTopK: parsedConfig.DEFAULT_CHILD_TOP_K,
  defaultFinalChildTopK: parsedConfig.DEFAULT_FINAL_CHILD_TOP_K,
  defaultMaxParents: parsedConfig.DEFAULT_MAX_PARENTS,
  defaultMaxContextTokens: parsedConfig.DEFAULT_MAX_CONTEXT_TOKENS,
  defaultEnableReranking: parsedConfig.DEFAULT_ENABLE_RERANKING,
};
