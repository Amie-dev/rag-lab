# Chapter 5 — Parent Resolution & Context Budgeting

This is **the** chapter. Everything before it produced a ranked list of small **children**. This chapter performs the defining "small → big" hop: it turns those children into a small set of large, deduplicated, budget-bounded **parents** — the actual context the LLM will read.

```text
Ranked CHILD candidates                    Parent Store
  child_A1 ─┐                                 │
  child_A2 ─┤── group by parentId ──► parent_A ┤──► aggregate + rank
  child_B1 ─┘                                 │
  child_C1 ──► parent_C ──────────────────────┤──► dedup + maxParents + token budget
                                              ▼
                                    Ranked PARENT contexts (generation-ready)
```

File: [`src/services/parent-resolver.service.ts`](../code/src/services/parent-resolver.service.ts)

## 🎯 The Five Responsibilities

```typescript
export interface ParentResolutionOptions {
  maxParents: number;
  maxContextTokens: number;
  scoreAggregation: ContextScoreAggregation;   // 'best_child' | 'mean_child' | 'sum_child'
}
```

`resolve` does exactly five things, in order:

1. **Group** matching children by `parentId`.
2. **Look up** the full parent chunk for each group (the hop).
3. **Deduplicate** parents (many children → one parent).
4. **Aggregate** child scores into a parent-level `rankScore`.
5. **Enforce** `maxParents` and the token budget.

```typescript
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
  // …steps 2, 3, 4 below…
}
```

> 📊 **`deduplicatedChildren`** is a computed diagnostic: if 24 children collapse into 9 parents, this is `24 − 9 = 15` — i.e. 15 redundant "slots" we refused to spend twice. It appears in the API response so operators can *see* the deduplication working.

### Steps 2 & 4: Resolve the Parent and Aggregate Evidence

```typescript
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

  // Parent rank blends strongest child evidence, aggregate strength, and a
  // mild corroboration bonus for multiple matching children.
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
```

Two important behaviours here:

- **Orphan safety**: `if (!parent) continue` handles a child whose parent isn't in the store (e.g. the store was partially cleared). The pipeline skips it instead of crashing — this is asserted by a dedicated unit test.
- **Corroboration bonus**: a parent that *several* independent children point at is almost certainly genuinely relevant. `Math.min(0.1, (n−1)·0.02)` rewards that, capped so it can never overwhelm the actual similarity score.

$$ \text{rankScore} = 0.6 \cdot \text{best} + 0.3 \cdot \text{mean} + \min(0.1,\ (n-1)\cdot 0.02) $$

### Step 3: Deduplicate and Rank

```typescript
// Deduplicated parents ranked by aggregate evidence strength.
contexts.sort((a, b) => b.rankScore - a.rankScore);
```

Because we iterated the `Map` of groups, each parent appears **exactly once** in `contexts` — deduplication is structural, not a post-filter. Sorting by `rankScore` then puts the strongest parents first.

### Step 5: The Context Budget (maxParents + maxContextTokens)

```typescript
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
```

The budget rule is subtle and deliberate:

- **Two independent caps**: `maxParents` bounds the *count*; `maxContextTokens` bounds the *size*. Both must hold. In practice the token budget usually binds first, because parents are large.
- **At least one parent always survives**: the condition `selected.length > 0 && …` guarantees we never return *zero* context just because the single best parent is larger than the budget. A pipeline that returns nothing is worse than one that returns the one best section.
- **Full observability**: `droppedByParentLimit`, `droppedByBudget`, and `budgetExceeded` record precisely *why* content was dropped, so the API consumer can tune knobs or warn the user.

## 🧪 Worked Example

Suppose the resolver receives these fused children (score shown):

```text
child_L1 (0.90) → parent_leave_A   (~360 tokens)
child_L2 (0.70) → parent_leave_A
child_L3 (0.55) → parent_leave_A
child_S1 (0.80) → parent_sub_B     (~370 tokens)
child_A1 (0.40) → parent_auth_C    (~350 tokens)
```

**Step 1 — Group:** three groups, `deduplicatedChildren = 5 − 3 = 2`.

**Step 4 — Aggregate & rank:**

| Parent | best | mean | n | rankScore = 0.6·best + 0.3·mean + min(0.1,(n−1)·0.02) |
| :--- | :--- | :--- | :--- | :--- |
| `parent_leave_A` | 0.90 | 0.717 | 3 | 0.54 + 0.215 + 0.04 = **0.795** |
| `parent_sub_B` | 0.80 | 0.800 | 1 | 0.48 + 0.24 + 0.00 = **0.720** |
| `parent_auth_C` | 0.40 | 0.400 | 1 | 0.24 + 0.12 + 0.00 = **0.360** |

**Step 5 — Budget** (`maxParents = 2`, `maxContextTokens = 700`):

- `parent_leave_A` admitted → `total = 360`.
- `parent_sub_B` admitted → `total = 730`? No — `360 + 370 = 730 > 700`, so it is **dropped by budget** and `budgetExceeded = true`.
- `parent_auth_C` skipped (already at `maxParents = 2`? no — only 1 selected, but it too exceeds budget) → `droppedByBudget`.

Result: `parentContexts = [parent_leave_A]`, `totalContextTokens = 360`, `budgetExceeded = true`. The LLM receives the single strongest, **complete** section.

## 🧭 Why This Design Is Production-Ready

| Concern | How it is handled |
| :--- | :--- |
| Duplicate parents from many children | Structural dedup via `Map` grouping |
| Context explosion (token cost) | `maxParents` + `maxContextTokens` budget |
| Empty context edge case | "Always admit ≥ 1 parent" rule |
| Orphaned children | `if (!parent) continue` |
| Silent truncation | `droppedBy*` / `budgetExceeded` diagnostics |
| Tuning aggregation per workload | `best_child` / `mean_child` / `sum_child` |

Next, proceed to **[Chapter 6 — Grounded Answer Generation & Pipeline Orchestration](./06-grounded-generation-and-orchestration.md)**.

