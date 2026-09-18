import { LLMGenerateOptions, LLMProvider, LLMResponse } from './base';
import { KeywordRetrievalResult } from '../schemas';

export interface OpenAILLMOptions {
  apiKey?: string;
  model?: string;
}

export class OpenAILLMProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(options: OpenAILLMOptions = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!this.apiKey) {
      throw new Error('OpenAI API Key is missing. Set OPENAI_API_KEY in environment or constructor.');
    }
  }

  public async generateAnswer(
    question: string,
    contextResults: KeywordRetrievalResult[],
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    const contextText = contextResults
      .map((res, i) => {
        const docName = res.chunk.metadata.filename || res.chunk.metadata.source || `Chunk ${i + 1}`;
        const scoreStr = res.score.toFixed(4);
        const termsStr = res.matchedTerms.join(', ');
        return `--- CITATION [${i + 1}] (${docName}, Score: ${scoreStr}, Matched Terms: [${termsStr}]) ---\n${res.chunk.content}`;
      })
      .join('\n\n');

    const systemPrompt =
      options?.systemPrompt ||
      `You are a senior AI technical assistant specializing in Lexical / Keyword RAG. Answer the user's question accurately using ONLY the provided context snippets below. Keep answers concise, highly specific, and cite source references [1], [2] where appropriate. If the context does not contain the required information, state that clearly.`;

    const userPrompt = `RETRIEVED CONTEXT:\n${contextText}\n\nUSER QUESTION: ${question}`;

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
