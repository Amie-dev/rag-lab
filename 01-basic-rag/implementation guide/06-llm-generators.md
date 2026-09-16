# Chapter 6 — LLM Response Synthesis & Context Injection

The final step of the Retrieval & Generation phase is **Context Augmentation** and **LLM Generation**.

The LLM is provided with:
1. **System Instructions**: Strict rules to answer using ONLY the retrieved context.
2. **Retrieved Context Chunks**: Top-K relevant text snippets with source attribution.
3. **User Question**: The original question asked by the user.

---

## 1. LLM Provider Interface (`src/llm/base.ts`)

```typescript
import { RetrievalResult } from '../schemas';

export interface LLMProvider {
  /**
   * Generate synthesized response based on context chunks and user question.
   */
  generateAnswer(question: string, contextChunks: RetrievalResult[]): Promise<string>;

  /**
   * Model name identifier.
   */
  modelName(): string;
}
```

---

## 2. Deterministic Mock LLM Provider (`src/llm/mock.ts`)

```typescript
import { LLMProvider } from './base';
import { RetrievalResult } from '../schemas';

export class MockLLMProvider implements LLMProvider {
  private model: string;

  constructor(model: string = 'mock-llm-v1') {
    this.model = model;
  }

  modelName(): string {
    return this.model;
  }

  async generateAnswer(question: string, contextChunks: RetrievalResult[]): Promise<string> {
    if (!contextChunks || contextChunks.length === 0) {
      return `I am unable to answer "${question}" because no relevant context documents were found in the knowledge base.`;
    }

    const contextSnippets = contextChunks
      .map((c, i) => `[Source ${i + 1} (${c.chunk.metadata.filename || c.chunk.metadata.source}, score: ${c.score.toFixed(3)})]: ${c.chunk.content}`)
      .join('\n\n');

    return `Based on the retrieved context, here is the answer to your question: "${question}"\n\n` +
      `Summary of Facts:\n${contextSnippets}\n\n` +
      `Conclusion: Basic RAG successfully retrieved ${contextChunks.length} relevant chunk(s) and synthesized this response using the ${this.model} provider.`;
  }
}
```

---

## 3. OpenAI Chat Provider (`src/llm/openai.ts`)

```typescript
import { LLMProvider } from './base';
import { RetrievalResult } from '../schemas';

export class OpenAILLMProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    if (!apiKey) {
      throw new Error('OpenAI API Key is required for OpenAILLMProvider');
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  modelName(): string {
    return this.model;
  }

  async generateAnswer(question: string, contextChunks: RetrievalResult[]): Promise<string> {
    const formattedContext = contextChunks
      .map((c, i) => `[Document ${i + 1}] (Score: ${c.score.toFixed(3)}):\n${c.chunk.content}`)
      .join('\n\n');

    const systemPrompt = `You are a factual, concise AI assistant powered by Retrieval-Augmented Generation (RAG).
Use ONLY the following retrieved context chunks to answer the user's question accurately.
If the context does not contain enough information to answer, state clearly that the knowledge base lacks sufficient details. Do not make up information.`;

    const userPrompt = `Context Chunks:\n${formattedContext}\n\nUser Question: ${question}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Chat API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return json.choices[0]?.message?.content || '';
  }
}
```

---

## 4. Google Gemini LLM Provider (`src/llm/gemini.ts`)

```typescript
import { LLMProvider } from './base';
import { RetrievalResult } from '../schemas';

export class GeminiLLMProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
    if (!apiKey) {
      throw new Error('Gemini API Key is required for GeminiLLMProvider');
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  modelName(): string {
    return this.model;
  }

  async generateAnswer(question: string, contextChunks: RetrievalResult[]): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const formattedContext = contextChunks
      .map((c, i) => `[Document ${i + 1}] (Score: ${c.score.toFixed(3)}):\n${c.chunk.content}`)
      .join('\n\n');

    const prompt = `System: You are a factual AI assistant using Retrieval-Augmented Generation (RAG).
Use ONLY the context provided below to answer the user's question. If the answer cannot be found in the context, respond with "Insufficient context to answer".

Context:
${formattedContext}

Question:
${question}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini LLM API error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };

    return json.candidates[0]?.content?.parts[0]?.text || '';
  }
}
```
