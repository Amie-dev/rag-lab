import { EmbeddingModel } from './base';

export class OpenAIEmbeddingModel implements EmbeddingModel {
  private apiKey: string;
  private model: string;
  private dim: number;

  constructor(apiKey: string, model: string = 'text-embedding-3-small', dimension: number = 1536) {
    if (!apiKey) {
      throw new Error('OpenAI API Key is required for OpenAIEmbeddingModel');
    }
    this.apiKey = apiKey;
    this.model = model;
    this.dim = dimension;
  }

  dimension(): number {
    return this.dim;
  }

  async embedQuery(text: string): Promise<number[]> {
    const res = await this.embedDocuments([text]);
    return res[0];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Embedding API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    return json.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }
}
