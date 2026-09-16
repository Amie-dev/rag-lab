import { EmbeddingModel } from './base';

export class GeminiEmbeddingModel implements EmbeddingModel {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'models/text-embedding-004') {
    if (!apiKey) {
      throw new Error('Gemini API Key is required for GeminiEmbeddingModel');
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  dimension(): number {
    return 768;
  }

  async embedQuery(text: string): Promise<number[]> {
    const res = await this.embedDocuments([text]);
    return res[0];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/${this.model}:batchEmbedContents?key=${this.apiKey}`;
    const requests = texts.map((t) => ({
      model: this.model,
      content: { parts: [{ text: t }] },
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini Embedding API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as {
      embeddings: Array<{ values: number[] }>;
    };

    return json.embeddings.map((e) => e.values);
  }
}
