import { EmbeddingModel } from '../embeddings/base';
import { VectorStore } from '../vectordb/base';
import { Chunk, RetrievalResult, SimilarityMetric } from '../schemas';

export class RetrievalEngine {
  private embeddingModel: EmbeddingModel;
  private vectorStore: VectorStore;
  private defaultMetric: SimilarityMetric;

  constructor(embeddingModel: EmbeddingModel, vectorStore: VectorStore, defaultMetric: SimilarityMetric = 'cosine') {
    this.embeddingModel = embeddingModel;
    this.vectorStore = vectorStore;
    this.defaultMetric = defaultMetric;
  }

  /**
   * Search top-K relevant chunks for a question.
   */
  async retrieve(
    question: string,
    topK: number = 3,
    metric?: SimilarityMetric,
    filter?: (chunk: Chunk) => boolean
  ): Promise<RetrievalResult[]> {
    if (!question || question.trim().length === 0) {
      return [];
    }

    const queryVector = await this.embeddingModel.embedQuery(question);
    const selectedMetric = metric || this.defaultMetric;

    return await this.vectorStore.search(queryVector, topK, selectedMetric, filter);
  }
}
