import { KeywordRetrievalResult } from '../schemas';

export interface LLMGenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: LLMUsage;
}

export interface LLMProvider {
  generateAnswer(
    question: string,
    contextResults: KeywordRetrievalResult[],
    options?: LLMGenerateOptions
  ): Promise<LLMResponse>;
}
