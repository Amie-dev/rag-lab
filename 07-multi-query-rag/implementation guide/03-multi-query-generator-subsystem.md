# Chapter 3 — Multi-Query Generator Subsystem

## 🤖 MultiQueryGeneratorService Architecture

Located in [`code/src/services/multi-query-generator.service.ts`](../code/src/services/multi-query-generator.service.ts), this service reformulates a user's question into multiple distinct search query variations.

---

## 🤖 OpenAI SDK TypeScript Structured Outputs

Using `openai.beta.chat.completions.parse` with `zodResponseFormat`:

```typescript
private async generateOpenAIQueryVariations(
  query: string,
  count: number
): Promise<string[]> {
  if (!this.openai) throw new Error('OpenAI client is not initialized.');

  const systemPrompt = `You are a search query generator for an AI retrieval-augmented generation (RAG) system.
Given the user's question, generate ${count} alternative search queries that preserve the original intent while exploring different terminology, phrasing, and technical perspectives.

Rules:
- Do NOT answer the question.
- Do NOT invent ungrounded facts.
- Keep each query concise, distinct, and focused on information retrieval.
- Output strictly formatted JSON matching the required schema.`;

  const completion = await this.openai.beta.chat.completions.parse({
    model: config.openaiCompletionModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Original Question: "${query}"` },
    ],
    response_format: zodResponseFormat(MultiQueryGenResponseSchema, 'multi_query_response'),
    temperature: 0.7,
  });

  return completion.choices[0].message.parsed?.queries || [];
}
```

---

## ⚙️ Smart Local Fallback Perspective Engine

When `OPENAI_API_KEY` is not provided, the local fallback engine applies domain synonym maps, intent shifts, and structural query transformations to generate diverse query variations:

```typescript
private generateLocalFallbackQueryVariations(query: string, count: number): string[] {
  const results: string[] = [];
  const lower = query.toLowerCase();

  const synMap: Record<string, string> = {
    'stop users from accessing': 'restrict user access and invalidate session',
    'session expires': 'authentication token expiration handling',
    'protected pages': 'authorized routes and endpoint security',
  };

  let synQuery = query;
  for (const [key, replacement] of Object.entries(synMap)) {
    if (lower.includes(key)) {
      synQuery = synQuery.replace(new RegExp(key, 'gi'), replacement);
    }
  }
  if (synQuery !== query) results.push(synQuery);

  results.push(`Implementation details and guide for ${query}`);
  results.push(`Architectural design and workflow of ${query.replace(/[?.]/g, '')}`);

  return results.slice(0, count);
}
```

In the next chapter, we will inspect the Result Merger, Deduplication, and Query Attribution subsystem.
