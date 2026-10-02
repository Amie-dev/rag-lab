# Chapter 3 — HyDE Generator Subsystem

## 🤖 Subsystem Overview

The `HyDEGeneratorService` ([`src/services/hyde-generator.service.ts`](../code/src/services/hyde-generator.service.ts)) generates synthetic hypothetical document passages designed to bridge the query-document representation gap.

```typescript
import OpenAI from 'openai';
import { config } from '../config/environment';
import { DomainContext, HypotheticalDocument } from '../types';

export class HyDEGeneratorService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Generates hypothetical document passage(s) designed to bridge the query-document representation gap.
   */
  async generateHypotheticalDocuments(
    query: string,
    numDocs: number = 1,
    domainContext: DomainContext = 'technical'
  ): Promise<HypotheticalDocument[]> {
    if (this.openai && config.openaiApiKey) {
      try {
        return await this.generateOpenAIHypotheticalDocs(query, numDocs, domainContext);
      } catch (error) {
        console.warn('OpenAI HyDE document generation failed, using local domain-aware generator fallback:', error);
      }
    }

    return this.generateLocalFallbackHypotheticalDocs(query, numDocs, domainContext);
  }

  private async generateOpenAIHypotheticalDocs(
    query: string,
    numDocs: number,
    domainContext: DomainContext
  ): Promise<HypotheticalDocument[]> {
    if (!this.openai) throw new Error('OpenAI client is not initialized.');

    const systemPrompt = this.getSystemPromptForDomain(domainContext, numDocs);
    const userPrompt = `User Question: "${query}"\n\nWrite ${
      numDocs === 1
        ? 'a hypothetical document passage'
        : `${numDocs} distinct hypothetical document passages (separated by '---NEXT_DOC---')`
    } that directly answers this question and could plausibly exist in the target knowledge base.`;

    const completion = await this.openai.chat.completions.create({
      model: config.openaiCompletionModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const responseText = completion.choices[0].message?.content || '';
    const rawDocs = responseText
      .split(/---NEXT_DOC---/g)
      .map((d) => d.trim())
      .filter(Boolean);

    const docsToReturn = rawDocs.length > 0 ? rawDocs : [responseText.trim()];

    return docsToReturn.map((text, idx) => ({
      id: `hyde_doc_${Date.now()}_${idx + 1}`,
      originalQuery: query,
      hypotheticalText: text,
      domainContext,
      createdAt: new Date().toISOString(),
    }));
  }

  /**
   * Constructs domain-specific system prompts to maximize retrieval efficiency.
   */
  private getSystemPromptForDomain(domainContext: DomainContext, numDocs: number): string {
    const base = `You are an expert AI system generating hypothetical documents for vector search retrieval (HyDE algorithm).
Your goal is to bridge the representation gap between short user questions and long declarative knowledge base documents.

Rules:
1. Write in a clear, declarative, expert informative style.
2. Include domain-specific terminology, explanations, mechanisms, and details that would realistically appear in a technical documentation page, standard operating procedure, or knowledge repository.
3. DO NOT state that this document is hypothetical, draft, or generated.
4. DO NOT write meta-commentary like "Here is a passage:". Return ONLY the document text itself.
${numDocs > 1 ? `5. If generating multiple documents, separate each distinct hypothetical passage with '---NEXT_DOC---'.` : ''}`;

    switch (domainContext) {
      case 'technical':
        return `${base}\nFocus: Software architecture, API specifications, database design, cloud infrastructure, vector search, and engineering best practices.`;
      case 'legal':
        return `${base}\nFocus: Contractual clauses, statutory provisions, compliance requirements, liability terms, and formal legal terminology.`;
      case 'medical':
        return `${base}\nFocus: Clinical diagnosis, therapeutic interventions, physiological mechanisms, patient management, and medical literature conventions.`;
      case 'financial':
        return `${base}\nFocus: Financial reporting, risk management policies, accounting standards, equity valuation, and regulatory compliance.`;
      default:
        return base;
    }
  }

  /**
   * Intelligent local fallback for producing realistic synthetic passages without external API calls.
   */
  private generateLocalFallbackHypotheticalDocs(
    query: string,
    numDocs: number,
    domainContext: DomainContext
  ): HypotheticalDocument[] {
    const qLower = query.toLowerCase();
    const docs: HypotheticalDocument[] = [];

    for (let i = 0; i < numDocs; i++) {
      let syntheticText = '';

      if (qLower.includes('rag') || qLower.includes('hallucinat') || qLower.includes('retriev')) {
        syntheticText = `Retrieval-Augmented Generation (RAG) incorporates external knowledge retrieval to eliminate model hallucinations. By embedding user questions and retrieving dense vector matches from a document store, context is supplied directly to the LLM. Hypothetical Document Embeddings (HyDE) further optimize semantic matching by replacing the raw user query with a generated synthetic passage that shares structural and lexical similarity with target knowledge base documents.`;
      } else if (qLower.includes('auth') || qLower.includes('jwt') || qLower.includes('token') || qLower.includes('session')) {
        syntheticText = `Authentication and session management rely on JSON Web Tokens (JWT) for stateless identity verification. Access tokens carry a short time-to-live (15 minutes), while refresh tokens (7-day TTL) allow seamless session renewal. Invalidated or expired sessions are tracked in a high-performance Redis blacklist to enforce immediate access revocation across all microservice endpoints.`;
      } else if (qLower.includes('postgres') || qLower.includes('db') || qLower.includes('index') || qLower.includes('sql')) {
        syntheticText = `Database performance optimization in PostgreSQL requires analyzing slow query logs via pg_stat_statements and adding composite B-Tree indexes on frequently filtered columns. Proper indexing eliminates expensive full table sequential scans and optimizes query execution plans under high concurrent transaction loads.`;
      } else {
        const keywords = query.split(/\W+/).filter((w) => w.length > 3).join(' ');
        syntheticText = `Comprehensive documentation regarding ${keywords || query}: The system implements declarative domain patterns to handle request processing, system optimization, and architectural reliability. Detailed procedures specify configuration, error handling, performance metrics, and standard operational protocols for ${query}.`;
      }

      docs.push({
        id: `local_hyde_doc_${Date.now()}_${i + 1}`,
        originalQuery: query,
        hypotheticalText: syntheticText,
        domainContext,
        createdAt: new Date().toISOString(),
      });
    }

    return docs;
  }
}

export const hydeGeneratorService = new HyDEGeneratorService();
```

Next, proceed to **[Chapter 4 — Result Fusion & Deduplication Engine](./04-result-fusion-deduplication-and-attribution.md)**.
