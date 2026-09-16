import { RetrievalResult } from '../schemas';

export interface LLMProvider {
  /**
   * Generate synthesized response based on context chunks and user question.
   */
  generateAnswer(question: string, contextChunks: RetrievalResult[]): Promise<string>;

  /**
   * Model name identifier.
   */
  modelName(): string;
}
