import { LLMGenerateOptions, LLMProvider, LLMResponse } from './base';
import { KeywordRetrievalResult } from '../schemas';

export interface GeminiLLMOptions {
  apiKey?: string;
  model?: string;
}

export class GeminiLLMProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(options: GeminiLLMOptions = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.model = options.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    if (!this.apiKey) {
      throw new Error('Gemini API Key is missing. Set GEMINI_API_KEY in environment or constructor.');
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

    const userPrompt = `System: ${systemPrompt}\n\nRETRIEVED CONTEXT:\n${contextText}\n\nUSER QUESTION: ${question}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.2,
          maxOutputTokens: options?.maxTokens ?? 800,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Chat Completion failed (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    };

    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content: answer,
      model: this.model,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
    };
  }
}
