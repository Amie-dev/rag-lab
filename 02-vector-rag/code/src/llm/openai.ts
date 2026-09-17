import { LLMGenerateOptions, LLMProvider, LLMResponse } from './base';
import { Chunk } from '../schemas';

export interface OpenAILLMOptions {
  apiKey?: string;
  model?: string;
}

export class OpenAILLMProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(options: OpenAILLMOptions = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = options.model || 'gpt-4o-mini';

    if (!this.apiKey) {
      throw new Error('OpenAI API Key is missing. Set OPENAI_API_KEY in environment or constructor.');
    }
  }

  public async generateAnswer(
    question: string,
    contextChunks: Chunk[],
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    const contextText = contextChunks
      .map((c, i) => `--- CHUNK ${i + 1} (${c.metadata.filename || 'Source'}) ---\n${c.content}`)
      .join('\n\n');

    const systemPrompt = `You are a helpful vector RAG search assistant. Answer the user's question accurately using ONLY the provided context chunks below. If the answer cannot be determined from the context, state that clearly.`;

    const userPrompt = `CONTEXT:\n${contextText}\n\nQUESTION: ${question}`;

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
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 800,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API Chat Completion failed (${response.status}): ${err}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content || '',
      model: this.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}
