import { LLMProvider } from '../llm/base';
import { RetrievalResult, RAGResponse } from '../schemas';

export class GenerationEngine {
  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  async generate(
    question: string,
    contextChunks: RetrievalResult[],
    retrievalLatencyMs: number = 0
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    const answer = await this.llmProvider.generateAnswer(question, contextChunks);
    const generationLatencyMs = Date.now() - startTime;

    return {
      question,
      answer,
      contextChunks,
      metadata: {
        model: this.llmProvider.modelName(),
        retrievalLatencyMs,
        generationLatencyMs,
        totalLatencyMs: retrievalLatencyMs + generationLatencyMs,
      },
    };
  }
}
