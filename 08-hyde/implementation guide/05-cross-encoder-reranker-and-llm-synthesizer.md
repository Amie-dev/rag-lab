# Chapter 5 — Cross-Encoder Reranker & Grounded LLM Synthesizer

## 🎯 1. Cross-Encoder Reranker Subsystem

The `RerankerService` ([`src/services/reranker.service.ts`](../code/src/services/reranker.service.ts)) evaluates retrieved candidate chunks against the **original user query** to refine relevance scores before passing them to the final LLM synthesizer.

```typescript
import { embeddingService } from './embedding.service';
import { MergedCandidateChunk } from '../types';

export class RerankerService {
  async rerankCandidates(
    originalQuery: string,
    candidates: MergedCandidateChunk[],
    finalTopK = 5
  ): Promise<MergedCandidateChunk[]> {
    if (candidates.length === 0) return [];
    if (candidates.length === 1) return candidates;

    const queryEmbedding = await embeddingService.getEmbedding(originalQuery);
    const queryTokens = this.tokenize(originalQuery);

    const scoredCandidates = candidates.map((candidate) => {
      // 1. Semantic Embedding Similarity against Original Query
      let semanticScore = 0;
      if (candidate.chunk.embedding && queryEmbedding.length > 0) {
        semanticScore = embeddingService.cosineSimilarity(queryEmbedding, candidate.chunk.embedding);
      }

      // 2. Lexical keyword overlap score
      const chunkText = (candidate.chunk.content + ' ' + (candidate.chunk.metadata.title || '')).toLowerCase();
      let matchCount = 0;
      for (const t of queryTokens) {
        if (chunkText.includes(t)) matchCount++;
      }
      const lexicalScore = queryTokens.length > 0 ? matchCount / queryTokens.length : 0;

      // 3. Multi-perspective bonus (reward chunks retrieved across multiple hypothetical docs/methods)
      const occurrenceBonus = Math.min(0.25, (candidate.occurrences - 1) * 0.1);

      // Weighted cross-encoder proxy score computation
      const rerankScore = semanticScore * 0.55 + lexicalScore * 0.25 + candidate.finalScore * 0.1 + occurrenceBonus;

      return {
        ...candidate,
        finalScore: Number(rerankScore.toFixed(4)),
      };
    });

    scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);
    return scoredCandidates.slice(0, finalTopK);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }
}

export const rerankerService = new RerankerService();
```

---

## 🤖 2. Grounded LLM Answer Synthesizer

The `LLMService` ([`src/services/llm.service.ts`](../code/src/services/llm.service.ts)) synthesizes a factually grounded final answer using OpenAI SDK Structured Outputs (`zodResponseFormat(GroundedAnswerSchema, 'grounded_answer')`).

```typescript
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { config } from '../config/environment';
import { GroundedAnswerResponse, GroundedAnswerSchema, HypotheticalDocument, MergedCandidateChunk } from '../types';

export class LLMService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  async generateGroundedAnswer(
    question: string,
    hypotheticalDocs: HypotheticalDocument[],
    contextChunks: MergedCandidateChunk[]
  ): Promise<GroundedAnswerResponse> {
    if (contextChunks.length === 0) {
      return {
        answer: 'I am unable to answer your query because no relevant context documents were found in the knowledge base.',
        confidenceScore: 0.0,
        citedChunkIds: [],
        keyInsights: ['No relevant document chunks retrieved from the knowledge base.'],
      };
    }

    if (this.openai && config.openaiApiKey) {
      try {
        return await this.generateOpenAIStructuredAnswer(question, contextChunks);
      } catch (error) {
        console.error('OpenAI Grounded Answer generation failed, falling back to local engine:', error);
      }
    }

    return this.generateLocalFallbackAnswer(question, contextChunks);
  }

  private async generateOpenAIStructuredAnswer(
    question: string,
    contextChunks: MergedCandidateChunk[]
  ): Promise<GroundedAnswerResponse> {
    if (!this.openai) throw new Error('OpenAI client is not initialized.');

    const formattedContext = contextChunks
      .map(
        (c) =>
          `[Document Chunk ID: ${c.chunk.id} | Title: ${c.chunk.metadata.title || 'Untitled'} | Category: ${
            c.chunk.metadata.category || 'General'
          }]\n${c.chunk.content}`
      )
      .join('\n\n---\n\n');

    const systemPrompt = `You are an expert Senior AI Backend Engineer powering a HyDE (Hypothetical Document Embeddings) RAG pipeline.
Your job is to provide an accurate, clear, and factually grounded answer strictly using the provided real retrieved context chunks.

CRITICAL INSTRUCTIONS:
- Ground your answer ONLY in the provided real retrieved context chunks.
- Do NOT introduce external facts or extrapolate beyond provided evidence.
- Cite the exact document chunk IDs used in your response.
- Output strictly formatted JSON matching the required schema.`;

    const userPrompt = `User Question: "${question}"\n\nReal Retrieved Context Chunks:\n${formattedContext}`;

    const completion = await this.openai.beta.chat.completions.parse({
      model: config.openaiCompletionModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(GroundedAnswerSchema, 'grounded_answer'),
      temperature: 0.1,
    });

    const parsed = completion.choices[0].message.parsed;
    if (!parsed) throw new Error('Failed to parse structured response from OpenAI API.');

    return parsed;
  }

  private generateLocalFallbackAnswer(
    question: string,
    contextChunks: MergedCandidateChunk[]
  ): GroundedAnswerResponse {
    const topChunk = contextChunks[0];
    const citedChunkIds = contextChunks.slice(0, 3).map((c) => c.chunk.id);
    const title = topChunk.chunk.metadata.title || 'Knowledge Base Document';

    return {
      answer: `[HyDE-Grounded Evidence Summary]: According to real knowledge-base context (${title}), ${topChunk.chunk.content}`,
      confidenceScore: Math.min(0.98, Math.max(0.7, topChunk.finalScore > 1 ? 0.95 : topChunk.finalScore)),
      citedChunkIds,
      keyInsights: contextChunks.slice(0, 3).map((c) => {
        const cTitle = c.chunk.metadata.title || 'Chunk ' + c.chunk.id;
        return `[${cTitle}] (retrieved via ${c.retrievedByMethods.join(', ')}): ${c.chunk.content.slice(0, 110)}...`;
      }),
    };
  }
}

export const llmService = new LLMService();
```

Next, proceed to **[Chapter 6 — HyDE RAG Pipeline Orchestrator](./06-hyde-rag-pipeline-orchestrator.md)**.
