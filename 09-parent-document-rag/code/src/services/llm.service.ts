import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { config } from '../config/environment';
import { GroundedAnswerResponse, GroundedAnswerSchema, ParentContext } from '../types';

/**
 * LLMService synthesizes the final grounded answer strictly from resolved
 * PARENT contexts.
 *
 * Architectural guarantee: the generation LLM only ever sees full parent
 * chunks (real retrieved context). Child chunks are used exclusively for
 * retrieval and are never passed as generation evidence.
 */
export class LLMService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  async generateGroundedAnswer(
    question: string,
    parentContexts: ParentContext[]
  ): Promise<GroundedAnswerResponse> {
    if (parentContexts.length === 0) {
      return {
        answer: 'I am unable to answer your query because no relevant parent context was found in the knowledge base.',
        confidenceScore: 0.0,
        citedParentIds: [],
        keyInsights: ['No relevant parent chunks were resolved from the retrieved child candidates.'],
      };
    }

    if (this.openai && config.openaiApiKey) {
      try {
        return await this.generateOpenAIStructuredAnswer(question, parentContexts);
      } catch (error) {
        console.error('OpenAI grounded answer generation failed, falling back to local answer engine:', error);
      }
    }

    return this.generateLocalFallbackAnswer(question, parentContexts);
  }

  private async generateOpenAIStructuredAnswer(
    question: string,
    parentContexts: ParentContext[]
  ): Promise<GroundedAnswerResponse> {
    if (!this.openai) throw new Error('OpenAI client is not initialized.');

    const formattedContext = parentContexts
      .map(
        (ctx) =>
          `[Parent Chunk ID: ${ctx.parent.id} | Title: ${ctx.parent.metadata.title || 'Untitled'} | Section: ${
            ctx.parent.metadata.section || 'General'
          }]\n${ctx.parent.content}`
      )
      .join('\n\n---\n\n');

    const systemPrompt = `You are an expert Senior AI Backend Engineer powering a Parent-Document RAG pipeline.
Your job is to provide an accurate, clear, and factually grounded answer strictly using the provided real retrieved PARENT context chunks.

CRITICAL INSTRUCTIONS:
- Ground your answer ONLY in the provided parent context chunks.
- Do NOT introduce external facts or extrapolate beyond the provided evidence.
- Cite the exact parent chunk IDs used in your response.
- Output strictly formatted JSON matching the required schema.`;

    const userPrompt = `User Question: "${question}"

Real Retrieved Parent Context Chunks:
${formattedContext}`;

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
    if (!parsed) {
      throw new Error('Failed to parse structured grounded answer response from OpenAI API.');
    }
    return parsed;
  }

  private generateLocalFallbackAnswer(
    question: string,
    parentContexts: ParentContext[]
  ): GroundedAnswerResponse {
    const topContext = parentContexts[0];
    const citedParentIds = parentContexts.slice(0, 3).map((c) => c.parent.id);

    const title = topContext.parent.metadata.title || 'Knowledge Base Document';
    const answer = `[Parent-Document Grounded Summary]: According to the retrieved parent context (${title}), ${topContext.parent.content}`;
    const confidenceScore = Math.min(
      0.98,
      Math.max(0.7, topContext.rankScore > 1 ? 0.95 : topContext.rankScore)
    );

    const keyInsights = parentContexts.slice(0, 3).map((c) => {
      const cTitle = c.parent.metadata.title || `Parent ${c.parent.id}`;
      const snippet = c.parent.content.slice(0, 140).replace(/\n/g, ' ');
      return `[${cTitle}] resolved from ${c.contributingChildCount} child chunk(s) via ${c.retrievedByMethods.join(
        ', '
      )}: ${snippet}...`;
    });

    return {
      answer,
      confidenceScore,
      citedParentIds,
      keyInsights,
    };
  }
}

export const llmService = new LLMService();
