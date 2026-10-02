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

  /**
   * Synthesizes a grounded, verifiable answer using real retrieved knowledge base chunks.
   * Crucially, hypothetical documents are NOT passed as ground truth evidence.
   */
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
        keyInsights: ['No relevant document chunks were retrieved from the knowledge base.'],
      };
    }

    if (this.openai && config.openaiApiKey) {
      try {
        return await this.generateOpenAIStructuredAnswer(question, contextChunks);
      } catch (error) {
        console.error('OpenAI Grounded Answer generation failed, falling back to local answer engine:', error);
      }
    }

    return this.generateLocalFallbackAnswer(question, contextChunks);
  }

  /**
   * OpenAI Structured Output generation enforcing Zod schema validation.
   */
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

    const userPrompt = `User Question: "${question}"

Real Retrieved Knowledge Base Context Chunks:
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

  /**
   * Local answer synthesizer fallback for zero-dependency / offline execution.
   */
  private generateLocalFallbackAnswer(
    question: string,
    contextChunks: MergedCandidateChunk[]
  ): GroundedAnswerResponse {
    const topChunk = contextChunks[0];
    const citedChunkIds = contextChunks.slice(0, 3).map((c) => c.chunk.id);

    const title = topChunk.chunk.metadata.title || 'Knowledge Base Document';
    const answer = `[HyDE-Grounded Evidence Summary]: According to real knowledge-base context (${title}), ${topChunk.chunk.content}`;
    const confidenceScore = Math.min(0.98, Math.max(0.7, topChunk.finalScore > 1 ? 0.95 : topChunk.finalScore));

    const keyInsights = contextChunks.slice(0, 3).map((c) => {
      const cTitle = c.chunk.metadata.title || 'Chunk ' + c.chunk.id;
      const snippet = c.chunk.content.slice(0, 120).replace(/\n/g, ' ');
      return `[${cTitle}] (retrieved via ${c.retrievedByMethods.join(', ')}): ${snippet}...`;
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
