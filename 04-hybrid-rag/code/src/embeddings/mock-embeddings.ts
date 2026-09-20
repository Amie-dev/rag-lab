import { EmbeddingModel } from './interface';

/**
 * Deterministic Mock Embedding Model for fast offline testing.
 * Generates normalized vectors using char frequency hashing.
 */
export class MockEmbeddingModel implements EmbeddingModel {
  private readonly dimension: number;

  constructor(dimension: number = 64) {
    this.dimension = dimension;
  }

  getDimension(): number {
    return this.dimension;
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.generateVector(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateVector(t));
  }

  private generateVector(text: string): number[] {
    const vector = new Array(this.dimension).fill(0);
    const normalizedText = text.toLowerCase().trim();

    if (!normalizedText) {
      vector[0] = 1.0;
      return vector;
    }

    // Tokenize into words and char n-grams
    const words = normalizedText.split(/\W+/).filter(Boolean);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = (hash * 31 + word.charCodeAt(j)) >>> 0;
      }
      const dimIndex = hash % this.dimension;
      vector[dimIndex] += 1.0 + (word.length % 5) * 0.1;

      // Add bi-gram influence
      if (i > 0) {
        const bigram = `${words[i - 1]}_${word}`;
        let biHash = 0;
        for (let j = 0; j < bigram.length; j++) {
          biHash = (biHash * 17 + bigram.charCodeAt(j)) >>> 0;
        }
        vector[biHash % this.dimension] += 0.5;
      }
    }

    // L2 Normalize
    let norm = 0;
    for (let i = 0; i < this.dimension; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm === 0) {
      vector[0] = 1.0;
      return vector;
    }

    return vector.map((v) => v / norm);
  }
}
