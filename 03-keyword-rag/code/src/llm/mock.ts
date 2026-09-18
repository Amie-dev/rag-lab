import { LLMGenerateOptions, LLMProvider, LLMResponse } from './base';
import { KeywordRetrievalResult } from '../schemas';

export class MockLLMProvider implements LLMProvider {
  private model = 'mock-llm-keyword-rag';

  public async generateAnswer(
    question: string,
    contextResults: KeywordRetrievalResult[],
    _options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    if (contextResults.length === 0) {
      return {
        content: `I could not find any relevant documents in the index to answer: "${question}".`,
        model: this.model,
      };
    }

    const topResult = contextResults[0];
    const topSource = topResult.chunk.metadata.filename || topResult.chunk.metadata.source || 'Document';

    const answer = `Based on retrieved lexical context [1] from ${topSource} (BM25 Score: ${topResult.bm25Score.toFixed(
      4
    )}, Matched Terms: [${topResult.matchedTerms.join(', ')}]):\n\n${topResult.chunk.content.slice(0, 300)}...`;

    return {
      content: answer,
      model: this.model,
      usage: {
        promptTokens: 120,
        completionTokens: 80,
        totalTokens: 200,
      },
    };
  }
}
