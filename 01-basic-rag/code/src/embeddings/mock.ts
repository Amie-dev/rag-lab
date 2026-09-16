import { EmbeddingModel } from './base';

export class MockEmbeddingModel implements EmbeddingModel {
  private dim: number;

  constructor(dim: number = 64) {
    this.dim = dim;
  }

  dimension(): number {
    return this.dim;
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.generateVector(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateVector(t));
  }

  private generateVector(text: string): number[] {
    const vector = new Array(this.dim).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const tokens = normalized.split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      vector[0] = 1.0;
      return vector;
    }

    // Deterministically map token hash to vector dimensions
    tokens.forEach((token) => {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const idx = Math.abs(hash) % this.dim;
      vector[idx] += 1.0;
    });

    // L2 Normalize vector
    let norm = 0;
    for (let i = 0; i < this.dim; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.dim; i++) {
        vector[i] /= norm;
      }
    } else {
      vector[0] = 1.0;
    }

    return vector;
  }
}
