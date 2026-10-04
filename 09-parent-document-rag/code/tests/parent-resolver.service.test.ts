import { parentResolverService } from '../src/services/parent-resolver.service';
import { parentStoreService } from '../src/services/parent-store.service';
import { ChildChunk, MergedChildCandidate, ParentChunk } from '../src/types';

const makeParent = (id: string, tokenEstimate: number): ParentChunk => ({
  id,
  documentId: 'doc',
  content: `parent content ${id}`,
  parentIndex: 0,
  totalParents: 1,
  childCount: 2,
  childIds: [],
  tokenEstimate,
  metadata: { title: `Parent ${id}` },
});

const makeChild = (id: string, parentId: string): ChildChunk => ({
  id,
  parentId,
  documentId: 'doc',
  content: `child ${id}`,
  chunkIndex: 0,
  totalChunks: 1,
  tokenEstimate: 5,
  metadata: {},
});

const candidate = (childId: string, parentId: string, score: number): MergedChildCandidate => ({
  child: makeChild(childId, parentId),
  parentId,
  finalScore: score,
  occurrences: 1,
  retrievedByMethods: ['child_dense'],
});

describe('ParentResolverService', () => {
  beforeEach(() => parentStoreService.clear());

  it('groups multiple children under one parent and deduplicates parents', () => {
    parentStoreService.addParents([makeParent('p1', 40), makeParent('p2', 40)]);

    const result = parentResolverService.resolve(
      [candidate('c1', 'p1', 0.9), candidate('c2', 'p1', 0.8), candidate('c3', 'p2', 0.5)],
      { maxParents: 5, maxContextTokens: 1000, scoreAggregation: 'mean_child' }
    );

    expect(result.parentContexts.length).toBe(2);
    expect(result.deduplicatedChildren).toBe(1); // 3 candidates collapse into 2 parents

    const top = result.parentContexts[0];
    expect(top.parent.id).toBe('p1');
    expect(top.contributingChildCount).toBe(2);
    expect(top.resolvedFromChildIds).toEqual(['c1', 'c2']);
    expect(top.bestChildScore).toBeCloseTo(0.9, 4);
  });

  it('enforces the maximum parent count', () => {
    parentStoreService.addParents([makeParent('p1', 10), makeParent('p2', 10), makeParent('p3', 10)]);

    const result = parentResolverService.resolve(
      [candidate('c1', 'p1', 0.9), candidate('c2', 'p2', 0.8), candidate('c3', 'p3', 0.7)],
      { maxParents: 2, maxContextTokens: 1000, scoreAggregation: 'best_child' }
    );

    expect(result.parentContexts.length).toBe(2);
    expect(result.droppedByParentLimit).toBe(1);
  });

  it('enforces the token budget while always keeping at least one parent', () => {
    parentStoreService.addParents([makeParent('p1', 80), makeParent('p2', 80)]);

    const result = parentResolverService.resolve(
      [candidate('c1', 'p1', 0.9), candidate('c2', 'p2', 0.8)],
      { maxParents: 5, maxContextTokens: 100, scoreAggregation: 'best_child' }
    );

    expect(result.parentContexts.length).toBe(1);
    expect(result.budgetExceeded).toBe(true);
    expect(result.droppedByBudget).toBe(1);
  });

  it('skips orphaned children whose parent is not in the store', () => {
    parentStoreService.addParents([makeParent('p1', 10)]);

    const result = parentResolverService.resolve(
      [candidate('c1', 'p1', 0.9), candidate('c9', 'missing', 0.95)],
      { maxParents: 5, maxContextTokens: 1000, scoreAggregation: 'best_child' }
    );

    expect(result.parentContexts.length).toBe(1);
    expect(result.parentContexts[0].parent.id).toBe('p1');
  });

  it('supports sum_child aggregation', () => {
    parentStoreService.addParents([makeParent('p1', 10)]);
    const result = parentResolverService.resolve(
      [candidate('c1', 'p1', 0.4), candidate('c2', 'p1', 0.3)],
      { maxParents: 5, maxContextTokens: 1000, scoreAggregation: 'sum_child' }
    );
    expect(result.parentContexts[0].aggregateScore).toBeCloseTo(0.7, 4);
  });

  it('returns an empty result for no candidates', () => {
    const result = parentResolverService.resolve([], { maxParents: 5, maxContextTokens: 1000, scoreAggregation: 'mean_child' });
    expect(result.parentContexts).toEqual([]);
    expect(result.uniqueParentCount).toBe(0);
  });
});
