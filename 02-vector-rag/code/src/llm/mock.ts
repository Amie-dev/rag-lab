import { LLMGenerateOptions, LLMProvider, LLMResponse } from './base';
import { Chunk } from '../schemas';

/**
 * Deterministic Mock LLM Provider for offline execution & testing.
 */
export class MockLLMProvider implements LLMProvider {
  public async generateAnswer(
    question: string,
    contextChunks: Chunk[],
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    if (contextChunks.length === 0) {
      return {
        content: `I could not find relevant context in the vector database to answer your question: "${question}".`,
        model: 'mock-llm-v1',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };
    }

    const contextSummary = contextChunks
      .map((c, i) => `[Source ${i + 1} (${c.metadata.filename || 'doc'})]: ${c.content.trim()}`)
      .join('\n\n');

    const answer = `Based on vector search context:\n\n${contextSummary}\n\nSummary Answer to "${question}": Vector retrieval identified ${contextChunks.length} relevant knowledge chunk(s).`;

    return {
      content: answer,
      model: 'mock-llm-v1',
      usage: {
        promptTokens: question.length + contextSummary.length,
        completionTokens: answer.length,
        totalTokens: question.length + contextSummary.length + answer.length,
      },
    };
  }
}
