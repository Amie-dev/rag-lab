import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const environmentSchema = z.object({
  PORT: z.string().transform((val) => parseInt(val, 10)).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_COMPLETION_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  DEFAULT_HYDE_NUM_DOCS: z.string().transform((val) => parseInt(val, 10)).default('1'),
  DEFAULT_HYDE_DOMAIN_CONTEXT: z.enum(['technical', 'general', 'legal', 'medical', 'financial']).default('technical'),
  DEFAULT_TOP_K_PER_HYDE_DOC: z.string().transform((val) => parseInt(val, 10)).default('5'),
  DEFAULT_FINAL_TOP_K: z.string().transform((val) => parseInt(val, 10)).default('5'),
  DEFAULT_ENABLE_RERANKING: z.string().transform((val) => val === 'true').default('true'),
});

const parseEnv = () => {
  const result = environmentSchema.safeParse(process.env);
  if (!result.success) {
    console.warn('⚠️ Environment configuration warnings:', result.error.format());
    return {
      PORT: parseInt(process.env.PORT || '3000', 10),
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_COMPLETION_MODEL: process.env.OPENAI_COMPLETION_MODEL || 'gpt-4o-mini',
      OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      DEFAULT_HYDE_NUM_DOCS: parseInt(process.env.DEFAULT_HYDE_NUM_DOCS || '1', 10),
      DEFAULT_HYDE_DOMAIN_CONTEXT: (process.env.DEFAULT_HYDE_DOMAIN_CONTEXT as any) || 'technical',
      DEFAULT_TOP_K_PER_HYDE_DOC: parseInt(process.env.DEFAULT_TOP_K_PER_HYDE_DOC || '5', 10),
      DEFAULT_FINAL_TOP_K: parseInt(process.env.DEFAULT_FINAL_TOP_K || '5', 10),
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
  defaultHyDENumDocs: parsedConfig.DEFAULT_HYDE_NUM_DOCS,
  defaultDomainContext: parsedConfig.DEFAULT_HYDE_DOMAIN_CONTEXT,
  defaultTopKPerDoc: parsedConfig.DEFAULT_TOP_K_PER_HYDE_DOC,
  defaultFinalTopK: parsedConfig.DEFAULT_FINAL_TOP_K,
  defaultEnableReranking: parsedConfig.DEFAULT_ENABLE_RERANKING,
};
