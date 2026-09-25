import OpenAI from 'openai';
import { config } from '../config/environment';

export class EmbeddingService {
  private openai: OpenAI | null = null;
  private readonly dimension = 128;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Generates a normalized vector embedding for the provided text.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (this.openai && config.openaiApiKey) {
      try {
        const response = await this.openai.embeddings.create({
          model: config.openaiEmbeddingModel,
          input: text,
        });
        return response.data[0].embedding;
      } catch (error) {
        console.warn('OpenAI Embedding API failed, falling back to local deterministic embedding generator:', error);
      }
    }

    return this.generateDeterministicLocalEmbedding(text);
  }

  /**
   * Generates embeddings in batch.
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (this.openai && config.openaiApiKey) {
      try {
        const response = await this.openai.embeddings.create({
          model: config.openaiEmbeddingModel,
          input: texts,
        });
        return response.data.map((item) => item.embedding);
      } catch (error) {
        console.warn('OpenAI Batch Embedding API failed, falling back to local generator:', error);
      }
    }

    return Promise.all(texts.map((t) => this.generateDeterministicLocalEmbedding(t)));
  }

  /**
   * Local deterministic 128-dimensional vector generator using character n-gram hashing
   * and semantic feature distribution. Guaranteed unit norm (L2 normalized).
   */
  private generateDeterministicLocalEmbedding(text: string): number[] {
    const vector = new Array(this.dimension).fill(0);
    const cleaned = text.toLowerCase().replace(/[^\w\s]/g, '');
    const tokens = cleaned.split(/\s+/).filter(Boolean);

    // Feature 1: Word hashing
    for (const token of tokens) {
      for (let i = 0; i < token.length; i++) {
        const hash = (token.charCodeAt(i) * 31 + i * 17) % this.dimension;
        vector[hash] += 1.0 / Math.log2(token.length + 2);
      }

      // Bi-gram tokens
      for (let i = 0; i < token.length - 1; i++) {
        const bigram = token.slice(i, i + 2);
        const hash = (bigram.charCodeAt(0) * 101 + bigram.charCodeAt(1) * 37) % this.dimension;
        vector[hash] += 0.5;
      }
    }

    // Feature 2: Length and position signal
    const lenHash = (text.length * 13) % this.dimension;
    vector[lenHash] += 0.25;

    // L2 Normalize
    let norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) norm = 1.0;

    return vector.map((val) => val / norm);
  }
}

export const embeddingService = new EmbeddingService();
