/**
 * Embedding Model Interface definition
 */

export interface EmbeddingModel {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
  getDimension(): number;
}
