import {
  ContextScoreAggregation,
  MergedChildCandidate,
  ParentContext,
  ParentResolutionResult,
} from '../types';
import { parentStoreService } from './parent-store.service';

export interface ParentResolutionOptions {
  maxParents: number;
  maxContextTokens: number;
  scoreAggregation: ContextScoreAggregation;
}

/**
 * ParentResolverService is the heart of Parent-Document RAG.
 *
 * Given fused CHILD candidates, it:
 *   1. Groups matching children by their `parentId`.
 *   2. Looks up the full PARENT chunk for each group (the "small → large" hop).
 *   3. Deduplicates parents (multiple children commonly map to one parent).
 *   4. Aggregates child evidence into a parent-level ranking score.
 *   5. Enforces a maximum parent count and a token budget for generation.
 */
export class ParentResolverService {
  /**
   * Collapses child candidates into ranked, budget-bounded parent contexts.
   */
  resolve(
    childCandidates: MergedChildCandidate[],
    options: ParentResolutionOptions
  ): ParentResolutionResult {
    const { maxParents, maxContextTokens, scoreAggregation } = options;
    const totalCandidateChildren = childCandidates.length;

    // 1. Group children by parent ID.
    const groups: Map<string, MergedChildCandidate[]> = new Map();
    for (const candidate of childCandidates) {
      if (!groups.has(candidate.parentId)) groups.set(candidate.parentId, []);
      groups.get(candidate.parentId)!.push(candidate);
    }

    const deduplicatedChildren = groups.size > 0 ? totalCandidateChildren - groups.size : 0;

    // 2 & 4. Resolve parents and aggregate evidence.
    const contexts: ParentContext[] = [];
    for (const [parentId, candidates] of groups.entries()) {
      const parent = parentStoreService.getParent(parentId);
      if (!parent) continue; // Orphaned child — parent not in store, skip.

      const sorted = [...candidates].sort((a, b) => b.finalScore - a.finalScore);
      const scores = sorted.map((c) => c.finalScore);
      const bestChildScore = scores[0];
      const meanChildScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const sumChildScore = scores.reduce((sum, s) => sum + s, 0);

      let aggregateScore: number;
      if (scoreAggregation === 'best_child') aggregateScore = bestChildScore;
      else if (scoreAggregation === 'sum_child') aggregateScore = sumChildScore;
      else aggregateScore = meanChildScore;

      // Parent rank blends the strongest child evidence, the aggregate strength
      // of all matching children, and a mild bonus for multiple corroborating
      // children (which indicates the parent is genuinely on-topic).
      const corroborationBonus = Math.min(0.1, (sorted.length - 1) * 0.02);
      const rankScore = bestChildScore * 0.6 + meanChildScore * 0.3 + corroborationBonus;

      contexts.push({
        parent,
        resolvedFromChildIds: sorted.map((c) => c.child.id),
        contributingChildCount: sorted.length,
        bestChildScore: Number(bestChildScore.toFixed(5)),
        aggregateScore: Number(aggregateScore.toFixed(5)),
        rankScore: Number(rankScore.toFixed(5)),
        retrievedByMethods: Array.from(new Set(sorted.flatMap((c) => c.retrievedByMethods))),
        tokenEstimate: parent.tokenEstimate,
      });
    }

    // 3. Deduplicated parents ranked by aggregate evidence strength.
    contexts.sort((a, b) => b.rankScore - a.rankScore);

    // 5. Apply the parent-count limit and the context token budget.
    const selected: ParentContext[] = [];
    let totalContextTokens = 0;
    let droppedByParentLimit = 0;
    let droppedByBudget = 0;
    let budgetExceeded = false;

    for (const context of contexts) {
      if (selected.length >= maxParents) {
        droppedByParentLimit++;
        continue;
      }
      // Always admit at least one parent, then respect the token budget.
      if (selected.length > 0 && totalContextTokens + context.tokenEstimate > maxContextTokens) {
        droppedByBudget++;
        budgetExceeded = true;
        continue;
      }
      selected.push(context);
      totalContextTokens += context.tokenEstimate;
    }

    return {
      parentContexts: selected,
      uniqueParentCount: contexts.length,
      totalCandidateChildren,
      deduplicatedChildren,
      totalContextTokens,
      droppedByParentLimit,
      droppedByBudget,
      budgetExceeded,
      scoreAggregation,
    };
  }
}

export const parentResolverService = new ParentResolverService();
