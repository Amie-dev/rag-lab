import {
  Document,
  Chunk,
  SearchQuery,
  KeywordRetrievalResult,
  RAGResponse,
  AnalyzerType,
  ScoringAlgorithm,
} from '../schemas';
import { KeywordSearchEngine } from '../search/engine';
import { RecursiveCharacterTextSplitter, TextSplitter } from '../splitters/text_splitter';
import { LLMProvider } from '../llm/base';
import { MockLLMProvider } from '../llm/mock';
import { OpenAILLMProvider } from '../llm/openai';
import { TextFileLoader, MarkdownLoader, DirectoryLoader } from '../loaders/file';

export interface RAGPipelineOptions {
  analyzerType?: AnalyzerType;
  scoringAlgorithm?: ScoringAlgorithm;
  splitter?: TextSplitter;
  llmProvider?: LLMProvider;
  useOpenAI?: boolean;
}

export class KeywordRAGPipeline {
  private searchEngine: KeywordSearchEngine;
  private analyzerType: AnalyzerType;
  private defaultAlgorithm: ScoringAlgorithm;
  private splitter: TextSplitter;
  private llmProvider: LLMProvider;

  constructor(options: RAGPipelineOptions = {}) {
    this.searchEngine = new KeywordSearchEngine();
    this.analyzerType = options.analyzerType || 'standard';
    this.defaultAlgorithm = options.scoringAlgorithm || 'bm25';
    this.splitter = options.splitter || new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });

    if (options.llmProvider) {
      this.llmProvider = options.llmProvider;
    } else if (options.useOpenAI || process.env.OPENAI_API_KEY) {
      this.llmProvider = new OpenAILLMProvider();
    } else {
      this.llmProvider = new MockLLMProvider();
    }
  }

  public getSearchEngine(): KeywordSearchEngine {
    return this.searchEngine;
  }

  /**
   * Ingests and indexes raw Document objects.
   */
  public async ingestDocuments(documents: Document[]): Promise<Chunk[]> {
    const chunks = this.splitter.splitDocuments(documents);
    this.searchEngine.indexChunks(chunks, this.analyzerType);
    return chunks;
  }

  /**
   * Ingests file (Markdown or Text) from disk path into index.
   */
  public async ingestFile(filePath: string): Promise<Chunk[]> {
    const isMd = filePath.endsWith('.md');
    const loader = isMd ? new MarkdownLoader(filePath) : new TextFileLoader(filePath);
    const documents = await loader.load();
    return this.ingestDocuments(documents);
  }

  /**
   * Ingests directory of text/markdown files.
   */
  public async ingestDirectory(dirPath: string): Promise<Chunk[]> {
    const loader = new DirectoryLoader(dirPath);
    const documents = await loader.load();
    return this.ingestDocuments(documents);
  }

  /**
   * Executes lexical keyword search without calling LLM.
   */
  public search(query: SearchQuery | string): KeywordRetrievalResult[] {
    const queryObj: SearchQuery =
      typeof query === 'string'
        ? {
            query,
            analyzerType: this.analyzerType,
            algorithm: this.defaultAlgorithm,
          }
        : {
            analyzerType: this.analyzerType,
            algorithm: this.defaultAlgorithm,
            ...query,
          };

    return this.searchEngine.search(queryObj);
  }

  /**
   * End-to-end RAG workflow: Retrieves top-K context chunks and generates answer via LLM.
   */
  public async query(
    question: string,
    options?: Partial<SearchQuery>
  ): Promise<RAGResponse> {
    const startTime = Date.now();

    const searchQuery: SearchQuery = {
      query: question,
      topK: options?.topK ?? 3,
      algorithm: options?.algorithm || this.defaultAlgorithm,
      analyzerType: options?.analyzerType || this.analyzerType,
      filter: options?.filter,
      explain: options?.explain ?? false,
    };

    const retrievalResults = this.searchEngine.search(searchQuery);
    const retrievalLatencyMs = Date.now() - startTime;

    const genStartTime = Date.now();
    const llmResponse = await this.llmProvider.generateAnswer(question, retrievalResults);
    const generationLatencyMs = Date.now() - genStartTime;

    const totalLatencyMs = Date.now() - startTime;

    return {
      question,
      answer: llmResponse.content,
      contextChunks: retrievalResults,
      metadata: {
        model: llmResponse.model,
        algorithm: searchQuery.algorithm || 'bm25',
        analyzerType: searchQuery.analyzerType || 'standard',
        totalChunksIndexed: this.searchEngine.getIndex().getTotalDocuments(),
        retrievalLatencyMs,
        generationLatencyMs,
        totalLatencyMs,
      },
    };
  }
}
