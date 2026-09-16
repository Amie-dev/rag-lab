import { DocumentLoader } from '../loaders/base';
import { TextSplitter } from '../splitters/base';
import { EmbeddingModel } from '../embeddings/base';
import { VectorStore } from '../vectordb/base';
import { Document, Chunk, VectorRecord } from '../schemas';

export class IngestionPipeline {
  private loader: DocumentLoader;
  private splitter: TextSplitter;
  private embeddingModel: EmbeddingModel;
  private vectorStore: VectorStore;

  constructor(
    loader: DocumentLoader,
    splitter: TextSplitter,
    embeddingModel: EmbeddingModel,
    vectorStore: VectorStore
  ) {
    this.loader = loader;
    this.splitter = splitter;
    this.embeddingModel = embeddingModel;
    this.vectorStore = vectorStore;
  }

  /**
   * Run full document ingestion pipeline for path or raw content.
   */
  async ingest(filePathOrContent: string): Promise<{ documents: Document[]; chunks: Chunk[]; count: number }> {
    const documents = await this.loader.load(filePathOrContent);
    if (documents.length === 0) {
      return { documents: [], chunks: [], count: 0 };
    }

    const chunks = this.splitter.splitDocuments(documents);
    if (chunks.length === 0) {
      return { documents, chunks: [], count: 0 };
    }

    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await this.embeddingModel.embedDocuments(chunkTexts);

    const records: VectorRecord[] = chunks.map((chunk, idx) => ({
      id: chunk.id,
      vector: embeddings[idx],
      chunk,
      metadata: chunk.metadata,
    }));

    await this.vectorStore.add(records);

    return {
      documents,
      chunks,
      count: records.length,
    };
  }
}
