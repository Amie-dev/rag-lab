# 🔄 Chapter 8 — End-to-End Keyword RAG Pipeline

Welcome to Chapter 8 of the **Keyword RAG Implementation Guide**. In this chapter, we explore the **KeywordRAGPipeline** facade, unifying ingestion, splitters, indexing, lexical search, and context-augmented answer synthesis into a clean interface.

---

## 1. Pipeline Architecture

Located in [`03-keyword-rag/code/src/pipeline/rag_pipeline.ts`](../code/src/pipeline/rag_pipeline.ts):

```typescript
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
    } else if (options.useGemini || process.env.GEMINI_API_KEY) {
      this.llmProvider = new GeminiLLMProvider();
    } else if (options.useOpenAI || process.env.OPENAI_API_KEY) {
      this.llmProvider = new OpenAILLMProvider();
    } else {
      this.llmProvider = new MockLLMProvider();
    }
  }
}
```

---

## 2. Document & File Ingestion

```typescript
// Ingest raw Document objects
public async ingestDocuments(documents: Document[]): Promise<Chunk[]> {
  const chunks = this.splitter.splitDocuments(documents);
  this.searchEngine.indexChunks(chunks, this.analyzerType);
  return chunks;
}

// Ingest single Markdown or Text file
public async ingestFile(filePath: string): Promise<Chunk[]> {
  const isMd = filePath.endsWith('.md');
  const loader = isMd ? new MarkdownLoader(filePath) : new TextFileLoader(filePath);
  const documents = await loader.load();
  return this.ingestDocuments(documents);
}
```

---

## 3. End-to-End Question Answering (`query`)

The `query` method orchestrates retrieval and generation while tracking fine-grained latency stats:

```typescript
public async query(question: string, options?: Partial<SearchQuery>): Promise<RAGResponse> {
  const startTime = Date.now();

  // 1. Lexical retrieval phase
  const retrievalResults = this.searchEngine.search({
    query: question,
    topK: options?.topK ?? 3,
    algorithm: options?.algorithm || this.defaultAlgorithm,
    analyzerType: options?.analyzerType || this.analyzerType,
  });
  const retrievalLatencyMs = Date.now() - startTime;

  // 2. LLM response generation phase
  const genStartTime = Date.now();
  const llmResponse = await this.llmProvider.generateAnswer(question, retrievalResults);
  const generationLatencyMs = Date.now() - genStartTime;

  return {
    question,
    answer: llmResponse.content,
    contextChunks: retrievalResults,
    metadata: {
      model: llmResponse.model,
      algorithm: options?.algorithm || this.defaultAlgorithm,
      analyzerType: options?.analyzerType || this.analyzerType,
      totalChunksIndexed: this.searchEngine.getIndex().getTotalDocuments(),
      retrievalLatencyMs,
      generationLatencyMs,
      totalLatencyMs: Date.now() - startTime,
    },
  };
}
```

In Chapter 9, we finish by examining the **CLI Tool & Automated Testing Suite**.
