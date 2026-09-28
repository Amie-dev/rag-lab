import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { config } from '../config/environment';
import { MultiQueryGenResponseSchema, QueryVariation } from '../types';

export class MultiQueryGeneratorService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Generates semantically diverse search query variations from an original user question.
   * Ensures original query is preserved as query 0, followed by generated variations.
   */
  async generateQueryVariations(
    originalQuery: string,
    numQueries: number = config.defaultNumGeneratedQueries
  ): Promise<QueryVariation[]> {
    const cleanOriginal = originalQuery.trim();
    const variations: QueryVariation[] = [
      {
        queryId: 'q_0_original',
        text: cleanOriginal,
        perspective: 'Original User Query',
      },
    ];

    let generatedTexts: string[] = [];

    if (this.openai && config.openaiApiKey) {
      try {
        generatedTexts = await this.generateOpenAIQueryVariations(cleanOriginal, numQueries);
      } catch (error) {
        console.error('OpenAI Multi-Query generation failed, executing local fallback engine:', error);
        generatedTexts = this.generateLocalFallbackQueryVariations(cleanOriginal, numQueries);
      }
    } else {
      generatedTexts = this.generateLocalFallbackQueryVariations(cleanOriginal, numQueries);
    }

    // Filter out duplicates or identical text to original
    const seenTexts = new Set<string>([cleanOriginal.toLowerCase()]);

    for (let i = 0; i < generatedTexts.length; i++) {
      const text = generatedTexts[i].trim();
      const lower = text.toLowerCase();
      if (!lower || seenTexts.has(lower)) continue;

      seenTexts.add(lower);
      variations.push({
        queryId: `q_${variations.length}_var`,
        text,
        perspective: `Generated Perspective ${variations.length}`,
      });

      if (variations.length >= numQueries + 1) break;
    }

    // Ensure we return at least 2 variations if requested
    if (variations.length === 1 && numQueries > 0) {
      const fallbacks = this.generateLocalFallbackQueryVariations(cleanOriginal, numQueries);
      for (const f of fallbacks) {
        if (!seenTexts.has(f.toLowerCase())) {
          seenTexts.add(f.toLowerCase());
          variations.push({
            queryId: `q_${variations.length}_var`,
            text: f,
            perspective: `Fallback Perspective ${variations.length}`,
          });
        }
      }
    }

    return variations;
  }

  /**
   * OpenAI Structured Output generation using `beta.chat.completions.parse`.
   */
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
- Use distinct technical synonyms and domain specific phrasing.
- Output strictly formatted JSON matching the required schema.`;

    const userPrompt = `Original Question: "${query}"

Generate ${count} semantically diverse alternative search queries.`;

    const completion = await this.openai.beta.chat.completions.parse({
      model: config.openaiCompletionModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: zodResponseFormat(MultiQueryGenResponseSchema, 'multi_query_response'),
      temperature: 0.7,
    });

    const parsed = completion.choices[0].message.parsed;
    if (!parsed || !parsed.queries || parsed.queries.length === 0) {
      throw new Error('Invalid response structure returned by OpenAI structured query generator.');
    }

    return parsed.queries;
  }

  /**
   * Smart rule-based local fallback engine that generates semantic perspectives
   * using domain-specific synonym maps, intent transformations, and structural query shifts.
   */
  private generateLocalFallbackQueryVariations(query: string, count: number): string[] {
    const results: string[] = [];
    const lower = query.toLowerCase();

    // Perspective 1: Synonym and technical term substitution
    let synQuery = query;
    const synMap: Record<string, string> = {
      'stop users from accessing': 'restrict user access and invalidate session',
      'session expires': 'authentication token expiration handling',
      'protected pages': 'authorized routes and endpoint security',
      'authentication': 'login user identity and authorization',
      'refund policy': 'subscription billing cancellation return terms',
      'password reset': 'credential recovery account security',
      'slow queries': 'database index execution plan performance tuning',
      'rate limit': 'api throttling request threshold control',
    };

    for (const [key, replacement] of Object.entries(synMap)) {
      if (lower.includes(key)) {
        synQuery = synQuery.replace(new RegExp(key, 'gi'), replacement);
      }
    }
    if (synQuery !== query) results.push(synQuery);

    // Perspective 2: Intent transformation (Mechanism / How-To formulation)
    if (lower.includes('how can i') || lower.includes('how do i') || lower.includes('how to')) {
      results.push(query.replace(/how (can|do|should) (i|we|users)/i, 'Best practices and steps for'));
    } else {
      results.push(`Implementation details and guide for ${query}`);
    }

    // Perspective 3: Underlying Concept & Architecture formulation
    results.push(`Architectural design and workflow of ${query.replace(/[?.]/g, '')}`);

    // Perspective 4: Terminology Expansion
    const words = query.split(/\s+/).filter((w) => w.length > 3);
    if (words.length >= 2) {
      results.push(`Configuration and management of ${words.slice(0, 3).join(' ')}`);
    }

    // Ensure we have enough candidates
    while (results.length < count) {
      results.push(`${query} technical specification overview ${results.length + 1}`);
    }

    return results.slice(0, count);
  }
}

export const multiQueryGeneratorService = new MultiQueryGeneratorService();
