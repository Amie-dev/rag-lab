import { LLMProvider } from './base';
import { RetrievalResult } from '../schemas';

export class OpenAILLMProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    if (!apiKey) {
      throw new Error('OpenAI API Key is required for OpenAILLMProvider');
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  modelName(): string {
    return this.model;
  }

  async generateAnswer(question: string, contextChunks: RetrievalResult[]): Promise<string> {
    const formattedContext = contextChunks
      .map((c, i) => `[Document ${i + 1}] (Score: ${c.score.toFixed(3)}):\n${c.chunk.content}`)
      .join('\n\n');

    const systemPrompt = `You are a factual, concise AI assistant powered by Retrieval-Augmented Generation (RAG).
Use ONLY the following retrieved context chunks to answer the user's question accurately.
If the context does not contain enough information to answer, state clearly that the knowledge base lacks sufficient details. Do not make up information.`;

    const userPrompt = `Context Chunks:\n${formattedContext}\n\nUser Question: ${question}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Chat API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return json.choices[0]?.message?.content || '';
  }
}
