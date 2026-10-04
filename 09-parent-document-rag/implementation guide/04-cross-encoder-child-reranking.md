# Chapter 4 — Cross-Encoder Child Reranking

Fusion produces a *good* candidate list, but it is still ordered by a bi-encoder (dense) + lexical blend. A **reranker** re-reads each candidate *together with the original query* and re-scores it — the classic "retrieve wide, then rank narrow" pattern.

> 🔑 **Reranking happens at the CHILD level, before parent resolution.** This is deliberate: if we resolved parents first and reranked later, two children pointing at the *same* parent would nearly tie, and a weak child could drag an otherwise-strong parent up or down. Ranking children first ensures the *most relevant children* — and therefore the *most relevant parents* — survive truncation.

File: [`src/services/reranker.service.ts`](../code/src/services/reranker.service.ts)

```typescript
import { MergedChildCandidate } from '../types';
import { embeddingService } from './embedding.service';

export class RerankerService {
  async rerankChildCandidates(
    originalQuery: string,
    candidates: MergedChildCandidate[],
    finalChildTopK: number = 8
  ): Promise<MergedChildCandidate[]> {
    if (candidates.length === 0) return [];
    if (candidates.length === 1) return candidates.slice(0, finalChildTopK);

    const queryEmbedding = await embeddingService.getEmbedding(originalQuery);
    const queryTokens = this.tokenize(originalQuery);

    const scored = candidates.map((candidate) => {
      // 1. Semantic embedding similarity against the ORIGINAL query.
      let semanticScore = 0;
      if (candidate.child.embedding && queryEmbedding.length > 0) {
        semanticScore = embeddingService.cosineSimilarity(queryEmbedding, candidate.child.embedding);
      }

      // 2. Lexical keyword overlap score.
      const childText = `${candidate.child.content} ${candidate.child.metadata.title || ''}`.toLowerCase();
      let matchCount = 0;
      for (const t of queryTokens) {
        if (childText.includes(t)) matchCount++;
      }
      const lexicalScore = queryTokens.length > 0 ? matchCount / queryTokens.length : 0;

      // 3. Multi-pass evidence bonus (reward children surfaced by several passes).
      const occurrenceBonus = Math.min(0.2, (candidate.occurrences - 1) * 0.08);
      // 4. Small bonus for being found by both dense and sparse retrieval.
      const hybridBonus = candidate.retrievedByMethods.length > 1 ? 0.08 : 0;

      const rerankScore =
        semanticScore * 0.5 +
        lexicalScore * 0.25 +
        candidate.finalScore * 0.1 +
        occurrenceBonus +
        hybridBonus;

      return { ...candidate, finalScore: Number(rerankScore.toFixed(5)) };
    });

    scored.sort((a, b) => b.finalScore - a.finalScore);
    return scored.slice(0, finalChildTopK);
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }
}

export const rerankerService = new RerankerService();
```

## 🧠 Anatomy of the Rerank Score

$$\text{rerankScore} = 0.5 \cdot \text{semantic} + 0.25 \cdot \text{lexical} + 0.1 \cdot \text{fusion} + \text{occurrenceBonus} + \text{hybridBonus}$$

| Term | Weight | Why |
| :--- | :--- | :--- |
| **`semanticScore`** | 0.5 | Cosine similarity of the child embedding to the *original query* — the strongest signal. |
| **`lexicalScore`** | 0.25 | Fraction of query keywords literally present — recovers exact-match cases semantics miss. |
| **`candidate.finalScore`** | 0.1 | The fused score from Chapter 3 (kept as a weak prior). |
| **`occurrenceBonus`** | ≤ 0.2 | `(occurrences - 1) * 0.08`, capped — rewards multi-pass agreement. |
| **`hybridBonus`** | 0.08 | Flat bonus when the child was found by *both* dense and sparse passes. |

Design decisions worth calling out for a senior review:

1. **Query is embedded exactly once** here (`queryEmbedding`), not once per candidate. That single vector is reused across every comparison — an important efficiency detail.
2. **The original query is the anchor.** Re-scoring against the *original* query (not the fusion score alone) is what makes a reranker effective: it re-introduces query intent that was diluted by the fusion math.
3. **Early returns** for 0 or 1 candidates skip all work (and skip an unnecessary embedding call).
4. **Bounded bonuses** (`Math.min`) prevent "found everywhere" candidates from overpowering genuine semantic relevance.
5. **Immutable update** (`{ ...candidate, finalScore }`) — we build new objects rather than mutating inputs, keeping the pipeline side-effect free and safe to reuse.

> 💡 **Production note**: This lab implements a **cross-encoder *proxy*** — a transparent, dependency-free blend of dense + lexical + fusion signals. In a production system you would replace the body of `rerankChildCandidates` with a real cross-encoder (e.g. a hosted Cohere/Jina reranker or a local `bge-reranker` model), keeping the *same method signature*. Because the rest of the pipeline depends only on the returned `MergedChildCandidate[]`, the swap is a one-file change.

Next, proceed to **[Chapter 5 — Parent Resolution & Context Budgeting](./05-parent-resolution-and-context-budgeting.md)**.
