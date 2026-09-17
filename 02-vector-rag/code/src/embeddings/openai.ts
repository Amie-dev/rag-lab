import { EmbeddingModel } from './base';
import { VectorMath } from '../math/vectorMath';

export interface OpenAIEmbeddingOptions {
  apiKey?: string;
  model?: string;
  dimensions?: number;
}

export class OpenAIEmbeddingModel implements EmbeddingModel {
  private apiKey: string;
  private model: string;
  private dims: number;

  constructor(options: OpenAIEmbeddingOptions = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = options.model || 'text-embedding-3-small';
    this.dims = options.dimensions || 1536;

    if (!this.apiKey) {
      throw new Error('OpenAI API Key is missing. Set OPENAI_API_KEY in environment or constructor.');
    }
  }

  public async embedQuery(text: string): Promise<number[]> {
    const vectors = await this.embedDocuments([text]);
    return vectors[0];
  }

  public async embedDocuments(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Embedding request failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
    return data.data.map((item) => VectorMath.l2Normalize(item.embedding));
  }

  public dimension(): number {
    return this.dims;
  }
}
