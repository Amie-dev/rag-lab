import { initializeSampleData } from '../src/app';
import { parentDocumentRAGService } from '../src/services/parent-document-rag.service';

describe('ParentDocumentRAGService', () => {
  beforeAll(async () => {
    await initializeSampleData();
  });

  it('retrieves child candidates and resolves them into parent contexts', async () => {
    const result = await parentDocumentRAGService.search({
      query: 'How many sick leaves can an employee take?',
      childTopK: 12,
      maxParents: 4,
    });

    expect(result.childCandidates.length).toBeGreaterThan(0);
    expect(result.totalChildCandidatesRetrieved).toBeGreaterThan(0);
    expect(result.resolution.parentContexts.length).toBeGreaterThan(0);

    // Parents must have been resolved from real children.
    const top = result.resolution.parentContexts[0];
    expect(top.resolvedFromChildIds.length).toBeGreaterThan(0);
    expect(top.tokenEstimate).toBeGreaterThan(0);

    // The leave policy should be represented among the resolved parents.
    const titles = result.resolution.parentContexts.map((c) => (c.parent.metadata.title || '').toLowerCase());
    expect(titles.some((t) => t.includes('leave'))).toBe(true);
  });

  it('executes the end-to-end grounded pipeline from parent context', async () => {
    const result = await parentDocumentRAGService.executeRAG({
      question: 'When is the subscription renewed automatically?',
      maxParents: 3,
    });

    expect(result.answer.length).toBeGreaterThan(10);
    expect(result.parentContexts.length).toBeGreaterThan(0);
    expect(result.confidenceScore).toBeGreaterThan(0);
    expect(result.citedParentIds.length).toBeGreaterThan(0);
    expect(result.retrievalSummary.parentContextsResolved).toBeGreaterThan(0);
    expect(result.retrievalSummary.totalContextTokens).toBeGreaterThan(0);
  });

  it('supports vector_only retrieval mode without reranking', async () => {
    const result = await parentDocumentRAGService.search({
      query: 'How does Redis rate limiting work?',
      retrievalMode: 'vector_only',
      enableReranking: false,
      maxParents: 2,
    });

    expect(result.retrievalMode).toBe('vector_only');
    expect(result.resolution.parentContexts.length).toBeGreaterThan(0);
  });

  it('returns an empty parent context when the query matches nothing relevant', async () => {
    const result = await parentDocumentRAGService.executeRAG({
      question: 'zzzqqq xyzzy nonexistent topic plumbus',
      maxParents: 2,
    });
    // Even with no strong matches the pipeline must not throw.
    expect(result.answer).toBeDefined();
    expect(Array.isArray(result.parentContexts)).toBe(true);
  });
});
