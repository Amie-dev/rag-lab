export interface EmbeddingModel {
  /**
   * Generates embedding vector for query text.
   */
  embedQuery(text: string): Promise<number[]>;

  /**
   * Generates embedding vectors for a batch of texts.
   */
  embedDocuments(texts: string[]): Promise<number[][]>;

  /**
   * Dimension size of the embedding vectors.
   */
  dimension(): number;
}
