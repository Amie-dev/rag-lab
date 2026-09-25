import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { config } from '../config/environment';
import { RAGAnswerResponse, RAGAnswerSchema, RerankedResult } from '../types';

export class LLMService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Generates a structured grounded RAG answer using top reranked context chunks.
   * Utilizes OpenAI SDK TypeScript with Structured Outputs (`zodResponseFormat`).
   */
  async generateAnswer(
    query: string,
    rerankedResults: RerankedResult[]
  ): Promise<RAGAnswerResponse> {
    if (rerankedResults.length === 0) {
      return {
        answer: "I am unable to answer your query because no relevant context documents were found.",
        confidenceScore: 0.0,
        citedChunkIds: [],
        keyInsights: ["No context candidates retrieved."],
      };
    }

    if (this.openai && config.openaiApiKey) {
      try {
        return await this.generateOpenAIStructuredAnswer(query, rerankedResults);
      } catch (error) {
        console.error('OpenAI Structured Output generation failed, using local fallback:', error);
      }
    }

    return this.generateLocalFallbackAnswer(query, rerankedResults);
  }

  /**
   * OpenAI Structured Output generation with strict Zod Schema validation via `beta.chat.completions.parse`.
   */
  private async generateOpenAIStructuredAnswer(
    query: string,
    rerankedResults: RerankedResult[]
  ): Promise<RAGAnswerResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client is not initialized.');
    }

    const formattedContext = rerankedResults
      .map(
        (res, idx) =>
          `[Document ID: ${res.chunk.id} | Title: ${res.chunk.metadata.title || 'Untitled'} | Relevance Score: ${res.stage2Score}]\n${res.chunk.content}`
      )
      .join('\n\n---\n\n');

    const systemPrompt = `You are a Senior AI Assistant powering a RAG (Retrieval-Augmented Generation) pipeline.
Your goal is to provide a precise, comprehensive, and factual answer to the user's query strictly using the provided reranked context documents.
- Cite the exact document chunk IDs used in your reasoning.
- Do NOT extrapolate beyond the context provided.
- Output strictly formatted JSON matching the required schema.`;

    const userPrompt = `Query: "${query}"

Reranked Context Chunks (Sorted by Relevance):
${formattedContext}`;

    const completion = await this.openai.beta.chat.completions.parse({
      model: config.openaiCompletionModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(RAGAnswerSchema, 'rag_answer'),
      temperature: 0.1,
    });

    const parsed = completion.choices[0].message.parsed;
    if (!parsed) {
      throw new Error('Failed to parse structured answer response from OpenAI API.');
    }

    return parsed;
  }

  /**
   * Deterministic local answer synthesizer fallback when operating without an API key.
   */
  private generateLocalFallbackAnswer(
    query: string,
    rerankedResults: RerankedResult[]
  ): RAGAnswerResponse {
    const topChunk = rerankedResults[0];
    const citedChunkIds = rerankedResults.slice(0, 3).map((r) => r.chunk.id);

    const answer = `Based on high-relevance reranked context (${topChunk.chunk.metadata.title}): ${topChunk.chunk.content}`;
    const confidenceScore = Math.min(0.98, Math.max(0.6, topChunk.stage2Score));

    const keyInsights = rerankedResults.slice(0, 3).map((r) => {
      const snippet = r.chunk.content.slice(0, 100).replace(/\n/g, ' ');
      return `[${r.chunk.metadata.title}]: ${snippet}...`;
    });

    return {
      answer,
      confidenceScore,
      citedChunkIds,
      keyInsights,
    };
  }
}

export const llmService = new LLMService();
