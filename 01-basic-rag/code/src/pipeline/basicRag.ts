import { RAGConfig, defaultConfig } from '../config';
import { DocumentLoader } from '../loaders/base';
import { TextDocumentLoader } from '../loaders/text';
import { TextSplitter } from '../splitters/base';
import { RecursiveCharacterTextSplitter } from '../splitters/character';
import { EmbeddingModel } from '../embeddings/base';
import { MockEmbeddingModel } from '../embeddings/mock';
import { OpenAIEmbeddingModel } from '../embeddings/openai';
import { GeminiEmbeddingModel } from '../embeddings/gemini';
import { VectorStore } from '../vectordb/base';
import { InMemoryVectorStore } from '../vectordb/inMemory';
import { LLMProvider } from '../llm/base';
import { MockLLMProvider } from '../llm/mock';
import { OpenAILLMProvider } from '../llm/openai';
import { GeminiLLMProvider } from '../llm/gemini';
import { IngestionPipeline } from './ingestion';
import { RetrievalEngine } from './retrieval';
import { GenerationEngine } from './generation';
import { Document, Chunk, RAGResponse, SimilarityMetric } from '../schemas';

export class BasicRAGPipeline {
  private config: RAGConfig;
  public loader: DocumentLoader;
  public splitter: TextSplitter;
  public embeddingModel: EmbeddingModel;
  public vectorStore: VectorStore;
  public llmProvider: LLMProvider;

  public ingestion: IngestionPipeline;
  public retrieval: RetrievalEngine;
  public generation: GenerationEngine;

  constructor(
    config?: Partial<RAGConfig>,
    customComponents?: {
      loader?: DocumentLoader;
      splitter?: TextSplitter;
      embeddingModel?: EmbeddingModel;
      vectorStore?: VectorStore;
      llmProvider?: LLMProvider;
    }
  ) {
    this.config = { ...defaultConfig, ...config };

    this.loader = customComponents?.loader ?? new TextDocumentLoader();
    this.splitter =
      customComponents?.splitter ??
      new RecursiveCharacterTextSplitter({
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap,
      });

    this.embeddingModel = customComponents?.embeddingModel ?? this.initEmbeddingModel();
    this.vectorStore = customComponents?.vectorStore ?? new InMemoryVectorStore();
    this.llmProvider = customComponents?.llmProvider ?? this.initLLMProvider();

    this.ingestion = new IngestionPipeline(this.loader, this.splitter, this.embeddingModel, this.vectorStore);
    this.retrieval = new RetrievalEngine(this.embeddingModel, this.vectorStore, this.config.similarityMetric);
    this.generation = new GenerationEngine(this.llmProvider);
  }

  /**
   * Ingest document file or raw text into vector store.
   */
  async ingest(filePathOrContent: string): Promise<{ documents: Document[]; chunks: Chunk[]; count: number }> {
    return await this.ingestion.ingest(filePathOrContent);
  }

  /**
   * Execute full RAG pipeline: Query -> Retrieve Top-K -> Generate Answer.
   */
  async query(question: string, topK?: number, metric?: SimilarityMetric): Promise<RAGResponse> {
    const k = topK || this.config.topK;
    const startRetrieval = Date.now();
    const contextChunks = await this.retrieval.retrieve(question, k, metric);
    const retrievalLatencyMs = Date.now() - startRetrieval;

    return await this.generation.generate(question, contextChunks, retrievalLatencyMs);
  }

  /**
   * Get count of vectors stored.
   */
  async getIndexedChunkCount(): Promise<number> {
    return await this.vectorStore.count();
  }

  private initEmbeddingModel(): EmbeddingModel {
    if (this.config.embeddingProvider === 'openai') {
      if (!this.config.openaiApiKey) throw new Error('OPENAI_API_KEY environment variable is missing.');
      return new OpenAIEmbeddingModel(this.config.openaiApiKey, this.config.openaiEmbeddingModel);
    }
    if (this.config.embeddingProvider === 'gemini') {
      if (!this.config.geminiApiKey) throw new Error('GEMINI_API_KEY environment variable is missing.');
      return new GeminiEmbeddingModel(this.config.geminiApiKey, this.config.geminiEmbeddingModel);
    }
    return new MockEmbeddingModel();
  }

  private initLLMProvider(): LLMProvider {
    if (this.config.llmProvider === 'openai') {
      if (!this.config.openaiApiKey) throw new Error('OPENAI_API_KEY environment variable is missing.');
      return new OpenAILLMProvider(this.config.openaiApiKey, this.config.openaiLlmModel);
    }
    if (this.config.llmProvider === 'gemini') {
      if (!this.config.geminiApiKey) throw new Error('GEMINI_API_KEY environment variable is missing.');
      return new GeminiLLMProvider(this.config.geminiApiKey, this.config.geminiLlmModel);
    }
    return new MockLLMProvider();
  }
}
