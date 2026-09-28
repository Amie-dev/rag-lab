# Chapter 5 — Multi-Query RAG Pipeline Orchestrator & LLM Synthesizer

## 🎯 Pipeline Orchestrator

Located in [`code/src/services/multi-query-rag.service.ts`](../code/src/services/multi-query-rag.service.ts), `MultiQueryRAGService` orchestrates query generation, multi-search retrieval, candidate fusion, optional reranking, and LLM answer generation:

```typescript
async executeRAG(request: MultiQueryRAGRequest): Promise<MultiQueryRAGResponse> {
  const searchResponse = await this.search({
    query: request.question,
    numQueries: request.numQueries,
    topKPerQuery: request.topKPerQuery,
    finalTopK: request.finalTopK,
    fusionStrategy: request.fusionStrategy,
    enableReranking: request.enableReranking,
    retrievalMode: request.retrievalMode,
  });

  const llmAnswer = await llmService.generateAnswer(
    request.question,
    searchResponse.generatedQueries,
    searchResponse.topContextChunks
  );

  return {
    question: request.question,
    generatedQueries: searchResponse.generatedQueries,
    answer: llmAnswer.answer,
    confidenceScore: llmAnswer.confidenceScore,
    citedChunkIds: llmAnswer.citedChunkIds,
    keyInsights: llmAnswer.keyInsights,
    retrievalSummary: {
      totalRetrieved: searchResponse.totalCandidatesRetrieved,
      uniqueDeduplicated: searchResponse.uniqueCandidatesDeduplicated,
      finalContextCount: searchResponse.topContextChunks.length,
      fusionStrategy: searchResponse.fusionStrategy,
    },
    retrievedContext: searchResponse.topContextChunks,
  };
}
```

---

## 🤖 LLM Answer Synthesizer

Located in [`code/src/services/llm.service.ts`](../code/src/services/llm.service.ts), `LLMService` formats the multi-query evidence into a structured system prompt and parses the OpenAI JSON response:

```typescript
const systemPrompt = `You are a Senior AI Assistant powering a Multi-Query RAG pipeline.
Your job is to provide an accurate, factually grounded answer to the user's question strictly using the provided context documents.

Context documents were retrieved using multiple semantic search query variations to ensure comprehensive coverage.
- Cite the exact document chunk IDs used in your response.
- Rely ONLY on the provided context. Do NOT extrapolate or introduce external facts.
- Output strictly formatted JSON matching the required schema.`;
```

In the next chapter, we will build the Express REST API backend architecture.
