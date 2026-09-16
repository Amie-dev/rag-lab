export interface EmbeddingModel {
  /**
   * Embed a single text string into a numeric vector.
   */
  embedQuery(text: string): Promise<number[]>;

  /**
   * Embed a batch of text strings into numeric vectors.
   */
  embedDocuments(texts: string[]): Promise<number[][]>;

  /**
   * Vector dimension size.
   */
  dimension(): number;
}
