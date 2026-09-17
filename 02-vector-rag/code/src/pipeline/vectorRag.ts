import { FileDocumentLoader } from '../loaders/text';
import { RecursiveCharacterTextSplitter } from '../splitters/character';
import { EmbeddingModel } from '../embeddings/base';
import { MockEmbeddingModel } from '../embeddings/mock';
import { OpenAIEmbeddingModel } from '../embeddings/openai';
import { GeminiEmbeddingModel } from '../embeddings/gemini';
import { LLMProvider } from '../llm/base';
import { MockLLMProvider } from '../llm/mock';
import { OpenAILLMProvider } from '../llm/openai';
import { GeminiLLMProvider } from '../llm/gemini';
import { VectorStore } from '../vectordb/vectorStore';
import {
  Chunk,
  Document,
  IndexConfig,
  IndexType,
  MetadataFilter,
  RAGResponse,
  RetrievalResult,
  SimilarityMetric,
  VectorRecord,
} from '../schemas';

export interface VectorRAGPipelineOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  minSimilarityScore?: number;
  similarityMetric?: SimilarityMetric;
  indexType?: IndexType;
  indexConfig?: IndexConfig;
  embeddingProvider?: 'mock' | 'openai' | 'gemini' | EmbeddingModel;
  llmProvider?: 'mock' | 'openai' | 'gemini' | LLMProvider;
}

export class VectorRAGPipeline {
  private splitter: RecursiveCharacterTextSplitter;
  private embedder: EmbeddingModel;
  private vectorStore: VectorStore;
  private llm: LLMProvider;

  private topK: number;
  private minSimilarityScore: number;
  private similarityMetric: SimilarityMetric;

  constructor(options: VectorRAGPipelineOptions = {}) {
    this.topK = options.topK ?? 3;
    this.minSimilarityScore = options.minSimilarityScore ?? 0.0;
    this.similarityMetric = options.similarityMetric ?? 'cosine';

    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize ?? 500,
      chunkOverlap: options.chunkOverlap ?? 50,
    });

    // Resolve Embedding Model
    if (typeof options.embeddingProvider === 'object') {
      this.embedder = options.embeddingProvider;
    } else if (options.embeddingProvider === 'openai') {
      this.embedder = new OpenAIEmbeddingModel();
    } else if (options.embeddingProvider === 'gemini') {
      this.embedder = new GeminiEmbeddingModel();
    } else {
      this.embedder = new MockEmbeddingModel();
    }

    // Resolve Vector Index Config
    const idxType = options.indexType ?? 'hnsw';
    const idxConfig: IndexConfig = options.indexConfig ?? { type: idxType };
    this.vectorStore = new VectorStore({ indexConfig: idxConfig });

    // Resolve LLM Provider
    if (typeof options.llmProvider === 'object') {
      this.llm = options.llmProvider;
    } else if (options.llmProvider === 'openai') {
      this.llm = new OpenAILLMProvider();
    } else if (options.llmProvider === 'gemini') {
      this.llm = new GeminiLLMProvider();
    } else {
      this.llm = new MockLLMProvider();
    }
  }

  /**
   * Ingest a string text or array of Document objects into the vector database.
   */
  public async ingest(input: string | Document | Document[]): Promise<{ numDocuments: number; numChunks: number }> {
    let docs: Document[] = [];

    if (typeof input === 'string') {
      docs = [
        {
          id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          content: input,
          metadata: { source: 'raw_string', createdAt: new Date().toISOString() },
        },
      ];
    } else if (Array.isArray(input)) {
      docs = input;
    } else {
      docs = [input];
    }

    const chunks = this.splitter.splitDocuments(docs);
    const contents = chunks.map((c) => c.content);

    const vectors = await this.embedder.embedDocuments(contents);

    const records: VectorRecord[] = chunks.map((chunk, i) => ({
      id: chunk.id,
      vector: vectors[i],
      chunk,
      metadata: chunk.metadata,
    }));

    await this.vectorStore.addBatch(records);

    return {
      numDocuments: docs.length,
      numChunks: chunks.length,
    };
  }

  /**
   * Load and ingest documents from a file or directory path.
   */
  public async ingestPath(pathOrDir: string): Promise<{ numDocuments: number; numChunks: number }> {
    const loader = new FileDocumentLoader(pathOrDir);
    const docs = await loader.load();
    return this.ingest(docs);
  }

  /**
   * Retrieve relevant chunks for a question using vector similarity search.
   */
  public async retrieve(
    question: string,
    topK?: number,
    filter?: MetadataFilter
  ): Promise<RetrievalResult[]> {
    const queryVector = await this.embedder.embedQuery(question);
    const k = topK ?? this.topK;

    return this.vectorStore.search(
      queryVector,
      k,
      this.similarityMetric,
      filter,
      this.minSimilarityScore
    );
  }

  /**
   * End-to-end RAG pipeline: Query Embedding -> ANN Vector Search -> Top-K Context Augmentation -> LLM Answer Synthesis.
   */
  public async query(
    question: string,
    topK?: number,
    filter?: MetadataFilter
  ): Promise<RAGResponse> {
    const startTime = Date.now();

    // 1. Vector Search Retrieval
    const retrievalStart = Date.now();
    const retrieved = await this.retrieve(question, topK, filter);
    const retrievalLatencyMs = Date.now() - retrievalStart;

    const contextChunks = retrieved.map((r) => r.chunk);

    // 2. LLM Answer Synthesis
    const generationStart = Date.now();
    const llmResp = await this.llm.generateAnswer(question, contextChunks);
    const generationLatencyMs = Date.now() - generationStart;

    const totalLatencyMs = Date.now() - startTime;

    return {
      question,
      answer: llmResp.content,
      contextChunks: retrieved,
      metadata: {
        model: llmResp.model,
        indexType: this.vectorStore.getIndexType() as IndexType,
        similarityMetric: this.similarityMetric,
        totalTokensUsed: llmResp.usage?.totalTokens,
        retrievalLatencyMs,
        generationLatencyMs,
        totalLatencyMs,
      },
    };
  }

  /**
   * Get underlying VectorStore instance.
   */
  public getVectorStore(): VectorStore {
    return this.vectorStore;
  }
}
