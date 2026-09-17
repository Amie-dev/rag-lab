# Chapter 6 — LLM Response Synthesis & Context Injection

The final stage of Retrieval-Augmented Generation is **Context Augmentation** and **LLM Generation**. The LLM receives the user's question along with the Top-K retrieved chunks formatted into a strict system prompt to synthesize a grounded, accurate answer.

In this chapter, we cover:
1. Prompt Engineering & Context Injection Strategies.
2. [src/llm/base.ts](../code/src/llm/base.ts) — The `LLMProvider` interface contract.
3. [src/llm/mock.ts](../code/src/llm/mock.ts) — Deterministic mock LLM generator.
4. [src/llm/openai.ts](../code/src/llm/openai.ts) — `OpenAILLMProvider` chat completion adapter (`gpt-4o-mini`).
5. [src/llm/gemini.ts](../code/src/llm/gemini.ts) — `GeminiLLMProvider` content generation adapter (`gemini-1.5-flash`).

---

## 1. Prompt Engineering & Context Ingestion Architecture

To eliminate hallucinations and restrict responses strictly to facts present in the knowledge base, the prompt template structures context chunks cleanly:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ SYSTEM PROMPT                                                          │
│ You are a factual, concise AI assistant powered by Basic RAG.          │
│ Use ONLY the following retrieved context chunks to answer the question. │
│ If context is insufficient, state clearly that information is missing. │
├────────────────────────────────────────────────────────────────────────┤
│ RETRIEVED CONTEXT CHUNKS                                               │
│ [Document 1] (Score: 0.942): <Content snippet 1>                       │
│ [Document 2] (Score: 0.881): <Content snippet 2>                       │
├────────────────────────────────────────────────────────────────────────┤
│ USER QUESTION                                                          │
│ <User question string>                                                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. LLM Provider Interface ([src/llm/base.ts](../code/src/llm/base.ts))

### Full Source Code

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

## 3. Deterministic Mock LLM Provider ([src/llm/mock.ts](../code/src/llm/mock.ts))

### Full Source Code

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

### 💡 Code Explanation
- Formats retrieved chunks into indexed source attribution lines (`[Source N (filename, score)]`).
- Generates a clear factual summary without requiring external API calls or network connectivity.

---

## 4. OpenAI Chat Provider ([src/llm/openai.ts](../code/src/llm/openai.ts))

Integration with OpenAI Chat Completions API (`/v1/chat/completions`).

### Full Source Code

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

### 💡 Line-by-Line Breakdown
- **Lines 90–92**: Formats context chunks into numbered blocks `[Document N] (Score: X.XXX)`.
- **Lines 94–97**: Sets strict system rules preventing hallucinations and enforcing zero external knowledge assumption.
- **Line 113**: Uses a low `temperature: 0.2` to ensure deterministic, focused generation.

---

## 5. Google Gemini LLM Provider ([src/llm/gemini.ts](../code/src/llm/gemini.ts))

Integration with Google Gemini REST API (`/v1beta/models/gemini-1.5-flash:generateContent`).

### Full Source Code

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
