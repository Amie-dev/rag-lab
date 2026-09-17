import { EmbeddingModel } from './base';
import { VectorMath } from '../math/vectorMath';

/**
 * Deterministic Semantic Mock Embedding Provider.
 * Generates 128-dimensional dense L2-normalized vectors using character-gram feature hashing & term frequencies.
 * Allows realistic offline semantic similarity vector search without external API dependencies.
 */
export class MockEmbeddingModel implements EmbeddingModel {
  private dim: number;

  constructor(dimension: number = 128) {
    this.dim = dimension;
  }

  public async embedQuery(text: string): Promise<number[]> {
    return this.generateSemanticVector(text);
  }

  public async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.generateSemanticVector(t)));
  }

  public dimension(): number {
    return this.dim;
  }

  private generateSemanticVector(text: string): number[] {
    const rawVector = new Array(this.dim).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = cleaned.split(/\s+/).filter(Boolean);

    for (const word of words) {
      // Feature hash 1: word-level hash
      const hash1 = this.hashString(word);
      const index1 = Math.abs(hash1) % this.dim;
      const val1 = hash1 % 2 === 0 ? 1 : -1;
      rawVector[index1] += val1 * 2.0;

      // Feature hash 2: character trigrams
      for (let i = 0; i < word.length - 2; i++) {
        const trigram = word.substring(i, i + 3);
        const hash2 = this.hashString(trigram);
        const index2 = Math.abs(hash2) % this.dim;
        const val2 = hash2 % 2 === 0 ? 0.5 : -0.5;
        rawVector[index2] += val2;
      }
    }

    // L2 normalize vector
    return VectorMath.l2Normalize(rawVector);
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash;
  }
}
