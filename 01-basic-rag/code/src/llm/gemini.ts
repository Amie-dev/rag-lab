import { LLMProvider } from './base';
import { RetrievalResult } from '../schemas';

export class GeminiLLMProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
    if (!apiKey) {
      throw new Error('Gemini API Key is required for GeminiLLMProvider');
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  modelName(): string {
    return this.model;
  }

  async generateAnswer(question: string, contextChunks: RetrievalResult[]): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const formattedContext = contextChunks
      .map((c, i) => `[Document ${i + 1}] (Score: ${c.score.toFixed(3)}):\n${c.chunk.content}`)
      .join('\n\n');

    const prompt = `System: You are a factual AI assistant using Retrieval-Augmented Generation (RAG).
Use ONLY the context provided below to answer the user's question. If the answer cannot be found in the context, respond with "Insufficient context to answer".

Context:
${formattedContext}

Question:
${question}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini LLM API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };

    return json.candidates[0]?.content?.parts[0]?.text || '';
  }
}
