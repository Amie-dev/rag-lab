import { LLMGenerateOptions, LLMProvider, LLMResponse } from './base';
import { Chunk } from '../schemas';

export interface GeminiLLMOptions {
  apiKey?: string;
  model?: string;
}

export class GeminiLLMProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(options: GeminiLLMOptions = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.model = options.model || 'gemini-1.5-flash';

    if (!this.apiKey) {
      throw new Error('Gemini API Key is missing. Set GEMINI_API_KEY in environment or constructor.');
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

    const promptText = `System: You are an expert vector RAG system. Answer the question using ONLY the provided context chunks below.\n\nCONTEXT:\n${contextText}\n\nQUESTION: ${question}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
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
