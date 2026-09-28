import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { config } from '../config/environment';
import { MergedCandidateChunk, QueryVariation, RAGAnswerResponse, RAGAnswerSchema } from '../types';

export class LLMService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Generates a structured grounded RAG answer using the deduplicated multi-query context chunks.
   */
  async generateAnswer(
    question: string,
    generatedQueries: QueryVariation[],
    contextChunks: MergedCandidateChunk[]
  ): Promise<RAGAnswerResponse> {
    if (contextChunks.length === 0) {
      return {
        answer: 'I am unable to answer your query because no relevant context documents were found in the knowledge base.',
        confidenceScore: 0.0,
        citedChunkIds: [],
        keyInsights: ['No relevant document chunks retrieved across generated query variations.'],
      };
    }

    if (this.openai && config.openaiApiKey) {
      try {
        return await this.generateOpenAIStructuredAnswer(question, generatedQueries, contextChunks);
      } catch (error) {
        console.error('OpenAI Grounded Answer generation failed, executing local fallback:', error);
      }
    }

    return this.generateLocalFallbackAnswer(question, contextChunks);
  }

  /**
   * OpenAI Structured Answer Generation with strict Zod validation.
   */
  private async generateOpenAIStructuredAnswer(
    question: string,
    generatedQueries: QueryVariation[],
    contextChunks: MergedCandidateChunk[]
  ): Promise<RAGAnswerResponse> {
    if (!this.openai) throw new Error('OpenAI client is not initialized.');

    const queryVariationsText = generatedQueries.map((q) => `- [${q.queryId}]: ${q.text}`).join('\n');

    const formattedContext = contextChunks
      .map(
        (c) =>
          `[Document ID: ${c.chunk.id} | Title: ${c.chunk.metadata.title || 'Untitled'} | Retrieved by ${c.occurrences} query variations: ${c.retrievedByQueries.join(', ')}]\n${c.chunk.content}`
      )
      .join('\n\n---\n\n');

    const systemPrompt = `You are a Senior AI Assistant powering a Multi-Query RAG pipeline.
Your job is to provide an accurate, factually grounded answer to the user's question strictly using the provided context documents.

Context documents were retrieved using multiple semantic search query variations to ensure comprehensive coverage.
- Cite the exact document chunk IDs used in your response.
- Rely ONLY on the provided context. Do NOT extrapolate or introduce external facts.
- Output strictly formatted JSON matching the required schema.`;

    const userPrompt = `User Question: "${question}"

Query Variations Generated for Retrieval:
${queryVariationsText}

Deduplicated Context Documents:
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
   * Local answer synthesizer fallback for zero-dependency execution.
   */
  private generateLocalFallbackAnswer(
    question: string,
    contextChunks: MergedCandidateChunk[]
  ): RAGAnswerResponse {
    const topChunk = contextChunks[0];
    const citedChunkIds = contextChunks.slice(0, 3).map((c) => c.chunk.id);

    const answer = `[Multi-Query Grounded Evidence]: Based on multi-perspective evidence (${topChunk.chunk.metadata.title || 'Documentation'}), ${topChunk.chunk.content}`;
    const confidenceScore = Math.min(0.98, Math.max(0.7, topChunk.finalScore > 1 ? 0.9 : topChunk.finalScore));

    const keyInsights = contextChunks.slice(0, 3).map((c) => {
      const title = c.chunk.metadata.title || 'Chunk ' + c.chunk.id;
      const snippet = c.chunk.content.slice(0, 110).replace(/\n/g, ' ');
      return `[${title}] (retrieved by ${c.occurrences} query perspectives): ${snippet}...`;
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
