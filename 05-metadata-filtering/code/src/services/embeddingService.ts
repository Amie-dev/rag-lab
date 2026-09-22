/**
 * Embedding Service Provider
 * Supports OpenAI API with deterministic zero-dependency local fallback.
 */

import { config } from '../config/index';

export class EmbeddingService {
  private dimension: number = 1536;

  /**
   * Generates embedding vector for a given text input.
   */
  public async getEmbedding(text: string): Promise<number[]> {
    if (config.openaiApiKey) {
      try {
        return await this.fetchOpenAIEmbedding(text);
      } catch (error) {
        console.warn('OpenAI Embedding call failed, falling back to local deterministic embedding generator:', error);
        return this.generateDeterministicLocalEmbedding(text);
      }
    }

    return this.generateDeterministicLocalEmbedding(text);
  }

  /**
   * Generates embeddings for a batch of text inputs.
   */
  public async getEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.getEmbedding(text));
    }
    return embeddings;
  }

  /**
   * Real OpenAI API call for embeddings
   */
  private async fetchOpenAIEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.embeddingModel,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Embedding API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    return data.data[0].embedding;
  }

  /**
   * Deterministic local embedding generator based on word tokens hash and position.
   * Produces normalized vectors of dimension 1536.
   */
  private generateDeterministicLocalEmbedding(text: string): number[] {
    const vector = new Array<number>(this.dimension).fill(0);
    const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, '');
    const tokens = normalizedText.split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      return vector;
    }

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let hash = 0;
      for (let j = 0; j < token.length; j++) {
        hash = (hash << 5) - hash + token.charCodeAt(j);
        hash |= 0;
      }

      const index = Math.abs(hash) % this.dimension;
      vector[index] += 1.0 / Math.sqrt(tokens.length);

      // Distribute secondary energy to neighboring indices for semantic smoothness
      const neighborIndex = (index + 137) % this.dimension;
      vector[neighborIndex] += 0.5 / Math.sqrt(tokens.length);
    }

    // Normalize vector to unit norm
    let sumSq = 0;
    for (let i = 0; i < this.dimension; i++) {
      sumSq += vector[i] * vector[i];
    }

    const norm = Math.sqrt(sumSq);
    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }
}
