export interface LLMProvider {
  generateAnswer(question: string, contextChunks: string[]): Promise<string>;
  getModelName(): string;
}
