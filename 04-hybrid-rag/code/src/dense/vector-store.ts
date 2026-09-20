import { Chunk, VectorRecord, DenseRetrievalResult, SimilarityMetric } from '../schemas';
import { EmbeddingModel } from '../embeddings/interface';
import { VectorIndex, FlatVectorIndex } from './indexes/flat-index';
import { HNSWVectorIndex } from './indexes/hnsw-index';
import { IVFVectorIndex } from './indexes/ivf-index';

export type IndexType = 'flat' | 'hnsw' | 'ivf';

export interface VectorStoreConfig {
  indexType?: IndexType;
  metric?: SimilarityMetric;
}

export class VectorStore {
  private embeddingModel: EmbeddingModel;
  private index: VectorIndex;
  private metric: SimilarityMetric;

  constructor(embeddingModel: EmbeddingModel, config?: VectorStoreConfig) {
    this.embeddingModel = embeddingModel;
    this.metric = config?.metric ?? 'cosine';
    const indexType = config?.indexType ?? 'flat';

    switch (indexType) {
      case 'hnsw':
        this.index = new HNSWVectorIndex(this.metric);
        break;
      case 'ivf':
        this.index = new IVFVectorIndex(this.metric);
        break;
      case 'flat':
      default:
        this.index = new FlatVectorIndex(this.metric);
        break;
    }
  }

  async addChunks(chunks: Chunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const texts = chunks.map((c) => c.content);
    const vectors = await this.embeddingModel.embedDocuments(texts);

    const records: VectorRecord[] = chunks.map((chunk, i) => ({
      id: chunk.id,
      vector: vectors[i],
      chunk,
      metadata: chunk.metadata
    }));

    this.index.addBatch(records);
  }

  async search(query: string, topK: number = 20): Promise<DenseRetrievalResult[]> {
    const queryVector = await this.embeddingModel.embedQuery(query);
    return this.index.search(queryVector, topK);
  }

  clear(): void {
    this.index.clear();
  }

  size(): number {
    return this.index.size();
  }
}
