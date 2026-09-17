import { EmbeddingModel } from './base';
import { VectorMath } from '../math/vectorMath';

export interface GeminiEmbeddingOptions {
  apiKey?: string;
  model?: string;
}

export class GeminiEmbeddingModel implements EmbeddingModel {
  private apiKey: string;
  private model: string;

  constructor(options: GeminiEmbeddingOptions = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.model = options.model || 'text-embedding-004';

    if (!this.apiKey) {
      throw new Error('Gemini API Key is missing. Set GEMINI_API_KEY in environment or constructor.');
    }
  }

  public async embedQuery(text: string): Promise<number[]> {
    const vectors = await this.embedDocuments([text]);
    return vectors[0];
  }

  public async embedDocuments(texts: string[]): Promise<number[][]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents?key=${this.apiKey}`;

    const requests = texts.map((t) => ({
      model: `models/${this.model}`,
      content: { parts: [{ text: t }] },
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Embedding request failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { embeddings: Array<{ values: number[] }> };
    return data.embeddings.map((item) => VectorMath.l2Normalize(item.values));
  }

  public dimension(): number {
    return 768;
  }
}
