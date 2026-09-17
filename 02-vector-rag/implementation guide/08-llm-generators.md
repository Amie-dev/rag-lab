# Chapter 8 — Context Augmentation & LLM Answer Synthesis

Once top-$K$ relevant chunks are retrieved from the vector database, they are augmented into a structured system prompt given to a Large Language Model (LLM) to generate a grounded, hallucination-free response.

Source code locations:
- [`src/llm/base.ts`](../code/src/llm/base.ts)
- [`src/llm/mock.ts`](../code/src/llm/mock.ts)
- [`src/llm/openai.ts`](../code/src/llm/openai.ts)
- [`src/llm/gemini.ts`](../code/src/llm/gemini.ts)

---

## 1. The LLMProvider Interface Contract

Defined in [`src/llm/base.ts`](../code/src/llm/base.ts):

```typescript
import { Chunk } from '../schemas';

export interface LLMGenerateOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  generateAnswer(question: string, contextChunks: Chunk[], options?: LLMGenerateOptions): Promise<LLMResponse>;
}
```

---

## 2. Prompt Template Engineering & Provider Implementation

### Prompt Structure
The context text is constructed by enumerating retrieved vector chunks alongside source metadata:

```text
System: You are an expert vector RAG system. Answer the question using ONLY the provided context chunks below.

CONTEXT:
--- CHUNK 1 (cat_care_guide.md) ---
Proper nutrition is essential for domestic cats. Feed high-quality commercial cat food...

--- CHUNK 2 (cat_care_guide.md) ---
Routine veterinary checkups, core vaccinations, and preventative treatments...

QUESTION: How do I take care of a domestic cat?
```

### OpenAI Provider Excerpt ([`src/llm/openai.ts`](../code/src/llm/openai.ts))

```typescript
export class OpenAILLMProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = options.model || 'gpt-4o-mini';
  }

  public async generateAnswer(question: string, contextChunks: Chunk[]): Promise<LLMResponse> {
    const contextText = contextChunks
      .map((c, i) => `--- CHUNK ${i + 1} (${c.metadata.filename || 'Source'}) ---\n${c.content}`)
      .join('\n\n');

    const systemPrompt = `You are a helpful vector RAG assistant. Answer using ONLY context chunks.`;
    const userPrompt = `CONTEXT:\n${contextText}\n\nQUESTION: ${question}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        temperature: 0.2,
      }),
    });

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      model: this.model,
      usage: data.usage ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.total_tokens } : undefined,
    };
  }
}
```
