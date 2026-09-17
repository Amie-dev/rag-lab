import { Chunk } from '../schemas';

export interface LLMGenerateOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  /**
   * Generates a context-augmented response based on retrieved chunks and question.
   */
  generateAnswer(question: string, contextChunks: Chunk[], options?: LLMGenerateOptions): Promise<LLMResponse>;
}
