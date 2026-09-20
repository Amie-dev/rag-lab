# 🤖 Chapter 6 — LLM Generators & Context Augmentation

Welcome to Chapter 6 of the **Hybrid RAG Implementation Guide**. In this chapter, we explore how retrieved hybrid candidate chunks are formatted into augmented context prompts and passed to LLM generators.

All code snippets in this chapter are taken directly from [`04-hybrid-rag/code`](../code).

---

## 1. LLM Provider Interface (`src/llm/interface.ts`)

File: [`04-hybrid-rag/code/src/llm/interface.ts`](../code/src/llm/interface.ts)

```typescript
export interface LLMProvider {
  generateAnswer(question: string, contextChunks: string[]): Promise<string>;
  getModelName(): string;
}
```

---

## 2. Mock LLM Generator (`src/llm/mock-llm.ts`)

File: [`04-hybrid-rag/code/src/llm/mock-llm.ts`](../code/src/llm/mock-llm.ts)

```typescript
import { LLMProvider } from './interface';

export class MockLLMProvider implements LLMProvider {
  private modelName: string;

  constructor(modelName: string = 'mock-gpt-4o-mini') {
    this.modelName = modelName;
  }

  getModelName(): string {
    return this.modelName;
  }

  async generateAnswer(question: string, contextChunks: string[]): Promise<string> {
    if (contextChunks.length === 0) {
      return `I could not find relevant information in the provided document context to answer "${question}".`;
    }

    const firstSnippet = contextChunks[0].slice(0, 180).replace(/\n/g, ' ');
    return (
      `Based on the retrieved context:\n` +
      `For your query "${question}", key relevant information from the top candidate document includes:\n` +
      `"${firstSnippet}..."\n\n` +
      `Summary: The retrieved hybrid context contains ${contextChunks.length} documents providing technical and conceptual details.`
    );
  }
}
```

---

## 3. OpenAI LLM Integration (`src/llm/openai-llm.ts`)

File: [`04-hybrid-rag/code/src/llm/openai-llm.ts`](../code/src/llm/openai-llm.ts)

```typescript
import { LLMProvider } from './interface';
import { MockLLMProvider } from './mock-llm';

export class OpenAILLMProvider implements LLMProvider {
  private apiKey: string;
  private modelName: string;
  private fallbackProvider: MockLLMProvider;

  constructor(apiKey?: string, modelName: string = 'gpt-4o-mini') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.modelName = modelName;
    this.fallbackProvider = new MockLLMProvider(modelName);
  }

  getModelName(): string {
    return this.modelName;
  }

  async generateAnswer(question: string, contextChunks: string[]): Promise<string> {
    if (!this.apiKey) {
      return this.fallbackProvider.generateAnswer(question, contextChunks);
    }

    try {
      const systemPrompt =
        'You are an expert AI Assistant specializing in technical knowledge bases and enterprise documentation. ' +
        'Answer the user question accurately using ONLY the provided retrieved context. ' +
        'If the answer is not contained in the context, explicitly state that.';

      const formattedContext = contextChunks.map((c, i) => `--- [ Document Chunk ${i + 1} ] ---\n${c}`).join('\n\n');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.modelName,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Question: ${question}\n\nContext Documents:\n${formattedContext}`
            }
          ]
        })
      });

      if (!response.ok) {
        console.warn(`[OpenAILLMProvider] HTTP ${response.status}. Using mock fallback.`);
        return this.fallbackProvider.generateAnswer(question, contextChunks);
      }

      const json = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      return json.choices[0]?.message?.content || 'No response generated.';
    } catch (error) {
      console.warn('[OpenAILLMProvider] OpenAI API call failed. Using fallback.', error);
      return this.fallbackProvider.generateAnswer(question, contextChunks);
    }
  }
}
```

### Methods Explanation (`OpenAILLMProvider`)
- `generateAnswer(question, contextChunks)`:Formats retrieved candidate chunks into `--- [ Document Chunk i ] ---` blocks, enforces strict grounding in system prompt, calls OpenAI Chat Completions endpoint, and falls back to `MockLLMProvider` gracefully if network errors occur.

In [Chapter 7](./07-end-to-end-hybrid-rag-pipeline.md), we will build the **End-to-End Hybrid RAG Pipeline**.
