import { LLMProvider } from './interface';

export class MockLLMProvider implements LLMProvider {
  private modelName: string;

  constructor(modelName: string = 'mock-gpt-4o-mini') {
    this.modelName = modelName;
  }

  getModelName(): string {
    return this.modelName;
  }

  async generateAnswer(question: string, contextChunks: string[]): Promise<string> {
    if (contextChunks.length === 0) {
      return `I could not find relevant information in the provided document context to answer "${question}".`;
    }

    const firstSnippet = contextChunks[0].slice(0, 180).replace(/\n/g, ' ');
    return (
      `Based on the retrieved context:\n` +
      `For your query "${question}", key relevant information from the top candidate document includes:\n` +
      `"${firstSnippet}..."\n\n` +
      `Summary: The retrieved hybrid context contains ${contextChunks.length} documents providing technical and conceptual details.`
    );
  }
}
