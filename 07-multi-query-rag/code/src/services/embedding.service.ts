import OpenAI from 'openai';
import { config } from '../config/environment';

export class EmbeddingService {
  private openai: OpenAI | null = null;
  private readonly dimension = 1536;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Generates a 1536-dimensional vector embedding for a given text prompt.
   * Uses OpenAI text-embedding-3-small when API key is set, otherwise computes a local deterministic embedding.
   */
  async getEmbedding(text: string): Promise<number[]> {
    if (this.openai && config.openaiApiKey) {
      try {
        const response = await this.openai.embeddings.create({
          model: config.openaiEmbeddingModel,
          input: text.replace(/\n/g, ' '),
        });
        return response.data[0].embedding;
      } catch (error) {
        console.warn('OpenAI Embedding API call failed, falling back to local deterministic embedding:', error);
      }
    }

    return this.generateLocalDeterministicEmbedding(text);
  }

  /**
   * Computes batch embeddings for an array of texts.
   */
  async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    if (this.openai && config.openaiApiKey) {
      try {
        const response = await this.openai.embeddings.create({
          model: config.openaiEmbeddingModel,
          input: texts.map((t) => t.replace(/\n/g, ' ')),
        });
        return response.data.map((item) => item.embedding);
      } catch (error) {
        console.warn('OpenAI Batch Embedding API call failed, falling back to local deterministic embeddings:', error);
      }
    }

    return texts.map((t) => this.generateLocalDeterministicEmbedding(t));
  }

  /**
   * Deterministic local embedding algorithm based on character n-grams and token hash projections.
   * Produces L2-normalized 1536D dense vectors with semantic overlap properties.
   */
  private generateLocalDeterministicEmbedding(text: string): number[] {
    const vector = new Array(this.dimension).fill(0);
    const normalizedText = text.toLowerCase().trim();
    const tokens = normalizedText.split(/\W+/).filter(Boolean);

    // Feature hashing for tokens
    for (const token of tokens) {
      const hash = this.hashString(token);
      const index = Math.abs(hash) % this.dimension;
      const val = hash % 2 === 0 ? 1.0 : -1.0;
      vector[index] += val;

      // Also add 3-gram feature projections for partial sub-word matching
      for (let i = 0; i <= token.length - 3; i++) {
        const trigram = token.slice(i, i + 3);
        const triHash = this.hashString(trigram);
        const triIndex = Math.abs(triHash) % this.dimension;
        vector[triIndex] += (triHash % 2 === 0 ? 0.5 : -0.5);
      }
    }

    // Compute L2 norm
    let sumSquares = 0;
    for (let i = 0; i < this.dimension; i++) {
      sumSquares += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSquares);

    if (norm === 0) {
      return vector;
    }

    // L2 Normalize
    for (let i = 0; i < this.dimension; i++) {
      vector[i] = vector[i] / norm;
    }

    return vector;
  }

  /**
   * FNV-1a Hash function
   */
  private hashString(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  }

  /**
   * Calculates Cosine Similarity between two L2-normalized dense vectors.
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}

export const embeddingService = new EmbeddingService();
