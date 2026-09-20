import { LLMProvider } from './interface';
import { MockLLMProvider } from './mock-llm';

export class OpenAILLMProvider implements LLMProvider {
  private apiKey: string;
  private modelName: string;
  private fallbackProvider: MockLLMProvider;

  constructor(apiKey?: string, modelName: string = 'gpt-4o-mini') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.modelName = modelName;
    this.fallbackProvider = new MockLLMProvider(modelName);
  }

  getModelName(): string {
    return this.modelName;
  }

  async generateAnswer(question: string, contextChunks: string[]): Promise<string> {
    if (!this.apiKey) {
      return this.fallbackProvider.generateAnswer(question, contextChunks);
    }

    try {
      const systemPrompt =
        'You are an expert AI Assistant specializing in technical knowledge bases and enterprise documentation. ' +
        'Answer the user question accurately using ONLY the provided retrieved context. ' +
        'If the answer is not contained in the context, explicitly state that.';

      const formattedContext = contextChunks.map((c, i) => `--- [ Document Chunk ${i + 1} ] ---\n${c}`).join('\n\n');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Question: ${question}\n\nContext Documents:\n${formattedContext}`
            }
          ]
        })
      });

      if (!response.ok) {
        console.warn(`[OpenAILLMProvider] HTTP ${response.status}. Using mock fallback.`);
        return this.fallbackProvider.generateAnswer(question, contextChunks);
      }

      const json = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      return json.choices[0]?.message?.content || 'No response generated.';
    } catch (error) {
      console.warn('[OpenAILLMProvider] OpenAI API call failed. Using fallback.', error);
      return this.fallbackProvider.generateAnswer(question, contextChunks);
    }
  }
}
