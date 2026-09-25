import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { config } from '../config/environment';
import {
  DocumentChunk,
  RerankerProvider,
  RerankBatchResponseSchema,
  RerankScoreSchema,
} from '../types';

export interface ScoredCandidate {
  chunk: DocumentChunk;
  score: number;
  reasoning?: string;
}

export class RerankerService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Reranks candidate documents against a query using the specified provider.
   */
  async rerank(
    query: string,
    candidates: DocumentChunk[],
    provider: RerankerProvider = 'local'
  ): Promise<ScoredCandidate[]> {
    if (candidates.length === 0) return [];

    switch (provider) {
      case 'openai-structured':
      case 'cross-encoder':
        if (this.openai && config.openaiApiKey) {
          return this.rerankWithOpenAIStructuredOutputs(query, candidates);
        }
        console.warn('OpenAI API Key missing, falling back to Local Cross-Encoder Reranker.');
        return this.rerankWithLocalCrossEncoder(query, candidates);

      case 'cohere':
        if (config.cohereApiKey) {
          return this.rerankWithCohere(query, candidates);
        }
        console.warn('Cohere API Key missing, falling back to Local Cross-Encoder Reranker.');
        return this.rerankWithLocalCrossEncoder(query, candidates);

      case 'local':
      default:
        return this.rerankWithLocalCrossEncoder(query, candidates);
    }
  }

  /**
   * Reranking via OpenAI SDK Structured Outputs (`beta.chat.completions.parse`).
   * Evaluates Query + Documents jointly to generate high-precision cross-attention scores.
   */
  private async rerankWithOpenAIStructuredOutputs(
    query: string,
    candidates: DocumentChunk[]
  ): Promise<ScoredCandidate[]> {
    if (!this.openai) {
      throw new Error('OpenAI client is not initialized');
    }

    const candidatePromptList = candidates.map((chunk, idx) => ({
      chunkId: chunk.id,
      title: chunk.metadata.title || `Document ${idx + 1}`,
      content: chunk.content,
    }));

    const systemPrompt = `You are a state-of-the-art Cross-Encoder Reranker model.
Your task is to evaluate the relevance of each candidate document with respect to the user's query.
- Evaluate exact semantic alignment, query intent satisfaction, and factual relevance.
- Assign a relevance score between 0.0 (completely irrelevant) and 1.0 (perfectly answers the query).
- Provide a brief 1-sentence reasoning for each score.
- DO NOT rely purely on keyword overlap; distinguish between superficially related documents and documents that actually satisfy the query.`;

    const userPrompt = `Query: "${query}"

Candidates to evaluate:
${JSON.stringify(candidatePromptList, null, 2)}`;

    try {
      const completion = await this.openai.beta.chat.completions.parse({
        model: config.openaiCompletionModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: zodResponseFormat(RerankBatchResponseSchema, 'rerank_response'),
        temperature: 0.0,
      });

      const parsed = completion.choices[0].message.parsed;
      if (!parsed || !parsed.rankings) {
        throw new Error('Failed to parse structured output from OpenAI reranker response.');
      }

      // Map score results back to candidates
      const scoreMap = new Map<string, { score: number; reasoning: string }>();
      for (const item of parsed.rankings) {
        scoreMap.set(item.chunkId, {
          score: Math.min(1.0, Math.max(0.0, item.relevanceScore)),
          reasoning: item.reasoning,
        });
      }

      return candidates.map((chunk) => {
        const result = scoreMap.get(chunk.id);
        return {
          chunk,
          score: result ? result.score : 0.1,
          reasoning: result ? result.reasoning : 'Fallback score assigned',
        };
      });
    } catch (error) {
      console.error('OpenAI Structured Output Reranking failed, falling back to local cross-encoder:', error);
      return this.rerankWithLocalCrossEncoder(query, candidates);
    }
  }

  /**
   * Reranking via Cohere Rerank API (if configured).
   */
  private async rerankWithCohere(
    query: string,
    candidates: DocumentChunk[]
  ): Promise<ScoredCandidate[]> {
    try {
      const response = await fetch('https://api.cohere.com/v1/rerank', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.cohereApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.cohereRerankModel,
          query: query,
          documents: candidates.map((c) => c.content),
          return_documents: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cohere API returned status ${response.status}`);
      }

      const data = (await response.json()) as {
        results: Array<{ index: number; relevance_score: number }>;
      };

      const scoredList: ScoredCandidate[] = new Array(candidates.length);
      for (const item of data.results) {
        const chunk = candidates[item.index];
        scoredList[item.index] = {
          chunk,
          score: item.relevance_score,
          reasoning: `Cohere Rerank score: ${item.relevance_score.toFixed(4)}`,
        };
      }

      return scoredList;
    } catch (error) {
      console.error('Cohere Rerank API failed, falling back to local cross-encoder:', error);
      return this.rerankWithLocalCrossEncoder(query, candidates);
    }
  }

  /**
   * High-Precision Deterministic Local Cross-Encoder algorithm.
   * Simulates joint query-document cross-attention by computing:
   * 1. Exact phrase proximity & n-gram co-occurrence.
   * 2. Direct intent matching (e.g. actions/verbs like "reset", "change", "create").
   * 3. Term position weighting (matches in title/header carry higher weight).
   * 4. Multi-term semantic coverage penalty for missing query terms.
   */
  public rerankWithLocalCrossEncoder(
    query: string,
    candidates: DocumentChunk[]
  ): ScoredCandidate[] {
    const queryClean = query.toLowerCase().trim();
    const queryTerms = queryClean.split(/\s+/).filter((t) => t.length > 1);

    return candidates.map((chunk) => {
      const titleClean = (chunk.metadata?.title || '').toLowerCase();
      const contentClean = chunk.content.toLowerCase();
      const fullText = `${titleClean} ${contentClean}`;

      if (queryTerms.length === 0) {
        return { chunk, score: 0.5, reasoning: 'Empty query terms' };
      }

      // Metric 1: Exact Phrase Match
      let exactPhraseScore = 0;
      if (contentClean.includes(queryClean)) exactPhraseScore += 0.45;
      if (titleClean.includes(queryClean)) exactPhraseScore += 0.25;

      // Metric 2: Term Coverage Ratio (how many unique query terms appear in the document)
      const matchedTerms = queryTerms.filter((term) => fullText.includes(term));
      const termCoverageRatio = matchedTerms.length / queryTerms.length;

      // Metric 3: Title & Header Weight Boost
      let titleMatchBoost = 0;
      for (const term of queryTerms) {
        if (titleClean.includes(term)) titleMatchBoost += 0.1 / queryTerms.length;
      }

      // Metric 4: Joint Attention / Word Proximity Score
      // Calculates how closely query terms appear next to each other in the document text
      let proximityScore = 0;
      if (matchedTerms.length >= 2) {
        const termIndices: number[] = [];
        for (const term of matchedTerms) {
          const idx = contentClean.indexOf(term);
          if (idx !== -1) termIndices.push(idx);
        }
        termIndices.sort((a, b) => a - b);

        let minWindow = Infinity;
        for (let i = 0; i < termIndices.length - 1; i++) {
          const diff = termIndices[i + 1] - termIndices[i];
          if (diff < minWindow) minWindow = diff;
        }

        if (minWindow < 50) proximityScore = 0.2;
        else if (minWindow < 150) proximityScore = 0.1;
      }

      // Metric 5: Intent Verb-Noun Coupling Check
      // e.g. "reset password" vs "change email"
      let intentMatchBonus = 0;
      const keyIntents = ['reset', 'password', 'login', 'auth', 'delete', 'update', 'refund'];
      const queryIntents = queryTerms.filter((t) => keyIntents.includes(t));
      if (queryIntents.length > 0) {
        const documentMatches = queryIntents.filter((t) => fullText.includes(t));
        if (documentMatches.length === queryIntents.length) {
          intentMatchBonus = 0.15;
        }
      }

      // Combine metrics into final Cross-Encoder score [0.0, 1.0]
      const rawScore =
        termCoverageRatio * 0.4 +
        exactPhraseScore +
        titleMatchBoost +
        proximityScore +
        intentMatchBonus;

      const finalScore = Math.min(0.99, Math.max(0.05, Math.round(rawScore * 1000) / 1000));

      const reasoning = `Local Cross-Encoder: term coverage ${(termCoverageRatio * 100).toFixed(0)}%, exact phrase match: ${exactPhraseScore > 0}, title match boost: ${titleMatchBoost > 0}`;

      return {
        chunk,
        score: finalScore,
        reasoning,
      };
    });
  }
}

export const rerankerService = new RerankerService();
