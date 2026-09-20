import { EmbeddingModel } from './interface';
import { MockEmbeddingModel } from './mock-embeddings';

export class OpenAIEmbeddingModel implements EmbeddingModel {
  private apiKey: string;
  private modelName: string;
  private dimension: number;
  private fallbackModel: MockEmbeddingModel;

  constructor(apiKey?: string, modelName: string = 'text-embedding-3-small', dimension: number = 1536) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.modelName = modelName;
    this.dimension = dimension;
    this.fallbackModel = new MockEmbeddingModel(dimension);
  }

  getDimension(): number {
    return this.dimension;
  }

  async embedQuery(text: string): Promise<number[]> {
    const results = await this.embedDocuments([text]);
    return results[0];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      return this.fallbackModel.embedDocuments(texts);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          input: texts,
          model: this.modelName
        })
      });

      if (!response.ok) {
        console.warn(`[OpenAIEmbeddingModel] HTTP error ${response.status}. Using mock fallback.`);
        return this.fallbackModel.embedDocuments(texts);
      }

      const json = (await response.json()) as { data: Array<{ embedding: number[] }> };
      return json.data.map((item) => item.embedding);
    } catch (error) {
      console.warn('[OpenAIEmbeddingModel] Network request failed. Using mock fallback.', error);
      return this.fallbackModel.embedDocuments(texts);
    }
  }
}
