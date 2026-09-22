/**
 * LLM Generation Service Provider
 * Supports OpenAI Chat Completion API with local fallback synthesizer.
 */

import { config } from '../config/index.js';
import { Chunk } from '../types/document.types.js';

export class LLMService {
  /**
   * Generates a grounded response given user question and retrieved context chunks.
   */
  public async generateAnswer(
    question: string,
    chunks: Chunk[],
    systemPrompt?: string
  ): Promise<{ answer: string; provider: string }> {
    if (chunks.length === 0) {
      return {
        answer: 'I could not find any eligible documents matching your metadata constraints to answer your question.',
        provider: 'system-fallback',
      };
    }

    if (config.openaiApiKey) {
      try {
        const answer = await this.fetchOpenAIChatCompletion(question, chunks, systemPrompt);
        return { answer, provider: 'openai' };
      } catch (error) {
        console.warn('OpenAI Chat Completion failed, falling back to local synthesizer:', error);
        return {
          answer: this.generateLocalSynthesizedAnswer(question, chunks),
          provider: 'local-fallback',
        };
      }
    }

    return {
      answer: this.generateLocalSynthesizedAnswer(question, chunks),
      provider: 'local-synthesizer',
    };
  }

  /**
   * OpenAI API Call
   */
  private async fetchOpenAIChatCompletion(
    question: string,
    chunks: Chunk[],
    customSystemPrompt?: string
  ): Promise<string> {
    const formattedContext = chunks
      .map(
        (c, idx) =>
          `[Source ${idx + 1}] (Tenant: ${c.metadata.tenant_id}, Dept: ${c.metadata.department || 'N/A'}, Type: ${c.metadata.file_type || 'N/A'})\n${c.content}`
      )
      .join('\n\n---\n\n');

    const defaultPrompt =
      'You are a strict, enterprise AI assistant. Answer the user question using ONLY the provided metadata-filtered retrieved documents. Cite your source documents clearly.';

    const systemMessage = customSystemPrompt || defaultPrompt;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.llmModel,
        messages: [
          { role: 'system', content: systemMessage },
          {
            role: 'user',
            content: `Retrieved Documents Context:\n${formattedContext}\n\nUser Question:\n${question}`,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Chat API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0].message.content;
  }

  /**
   * Local deterministic metadata-aware answer generator.
   */
  private generateLocalSynthesizedAnswer(question: string, chunks: Chunk[]): string {
    const primaryChunk = chunks[0];
    const tenantId = primaryChunk.metadata.tenant_id;
    const department = primaryChunk.metadata.department || 'general';

    const sourcesSummary = chunks
      .map((c, i) => `[Doc ${i + 1} (${c.metadata.file_type || 'doc'}) - Dept: ${c.metadata.department || 'N/A'}]`)
      .join(', ');

    return (
      `Based on the metadata-filtered context retrieved for tenant "${tenantId}" and department "${department}", ` +
      `here is the summary answering "${question}":\n\n` +
      `"${primaryChunk.content.trim()}"\n\n` +
      `Sources cited (${chunks.length} chunks retrieved under metadata constraints): ${sourcesSummary}.`
    );
  }
}
