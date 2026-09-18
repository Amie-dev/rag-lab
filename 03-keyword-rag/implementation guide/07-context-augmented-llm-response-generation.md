# 🤖 Chapter 7 — Context-Augmented LLM Response Generation

Welcome to Chapter 7 of the **Keyword RAG Implementation Guide**. In this chapter, we inspect the synthesis phase of Keyword RAG, formatting retrieved lexical chunks into context-augmented prompts and querying LLM providers.

---

## 1. Context Augmentation Strategy

Retrieval results produced by the BM25/TF-IDF search engine contain exact keyword matches and relevance scores. To allow the LLM to generate cited answers, each context chunk is formatted into a structured snippet tag:

```
--- CITATION [1] (technical_docs.md, Score: 3.4812, Matched Terms: [bm25, scoring]) ---
Okapi BM25 is a non-linear term frequency scoring function used in search engines...

--- CITATION [2] (architecture.md, Score: 1.9420, Matched Terms: [inverted, index]) ---
The inverted index maps normalized terms to posting records containing docId and term frequency...
```

---

## 2. LLM Provider Interface (`base.ts`)

Located in [`03-keyword-rag/code/src/llm/base.ts`](../code/src/llm/base.ts):

```typescript
export interface LLMProvider {
  generateAnswer(
    question: string,
    contextResults: KeywordRetrievalResult[],
    options?: LLMGenerateOptions
  ): Promise<LLMResponse>;
}
```

---

## 3. Concrete LLM Implementations

### 1. `MockLLMProvider` (`mock.ts`)
- Zero external dependencies or API keys required.
- Synthesizes deterministic answers based on top-ranked lexical terms and citation IDs. Ideal for offline unit tests.

### 2. `OpenAILLMProvider` (`openai.ts`)
- REST integration with OpenAI Chat Completions API (`gpt-4o-mini`).
- Includes system prompts enforcing strict grounding ("Answer using ONLY the provided context snippets below").

### 3. `GeminiLLMProvider` (`gemini.ts`)
- REST integration with Google Generative AI API (`gemini-1.5-flash`).
- Formats context citations into Google's `generateContent` payload structure.

```typescript
export class GeminiLLMProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(options: GeminiLLMOptions = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.model = options.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  }

  public async generateAnswer(question: string, contextResults: KeywordRetrievalResult[]): Promise<LLMResponse> {
    const contextText = contextResults
      .map((res, i) => `--- CITATION [${i + 1}] (${res.chunk.metadata.filename}, Score: ${res.score.toFixed(4)}) ---\n${res.chunk.content}`)
      .join('\n\n');

    const userPrompt = `RETRIEVED CONTEXT:\n${contextText}\n\nUSER QUESTION: ${question}`;
    // HTTP POST call to Google Gemini API...
  }
}
```

In Chapter 8, we build the unified **Keyword RAG Pipeline**.
