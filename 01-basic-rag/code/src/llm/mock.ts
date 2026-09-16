import { LLMProvider } from './base';
import { RetrievalResult } from '../schemas';

export class MockLLMProvider implements LLMProvider {
  private model: string;

  constructor(model: string = 'mock-llm-v1') {
    this.model = model;
  }

  modelName(): string {
    return this.model;
  }

  async generateAnswer(question: string, contextChunks: RetrievalResult[]): Promise<string> {
    if (!contextChunks || contextChunks.length === 0) {
      return `I am unable to answer "${question}" because no relevant context documents were found in the knowledge base.`;
    }

    const contextSnippets = contextChunks
      .map((c, i) => `[Source ${i + 1} (${c.chunk.metadata.filename || c.chunk.metadata.source}, score: ${c.score.toFixed(3)})]: ${c.chunk.content}`)
      .join('\n\n');

    return `Based on the retrieved context, here is the answer to your question: "${question}"\n\n` +
      `Summary of Facts:\n${contextSnippets}\n\n` +
      `Conclusion: Basic RAG successfully retrieved ${contextChunks.length} relevant chunk(s) and synthesized this response using the ${this.model} provider.`;
  }
}
