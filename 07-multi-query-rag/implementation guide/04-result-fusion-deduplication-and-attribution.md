# Chapter 4 — Result Fusion, Deduplication & Query Attribution

## 🔎 ResultMergerService Architecture

Located in [`code/src/services/result-merger.service.ts`](../code/src/services/result-merger.service.ts), `ResultMergerService` handles independent search execution across generated queries, deduplicates chunks by ID, and calculates score fusion with attribution metadata.

---

## 🔄 Deduplication & Attribution Tracking

```typescript
mergeAndDeduplicate(
  retrievalResults: SingleQueryRetrievalResult[],
  fusionStrategy: FusionStrategy = 'rrf',
  rrfKConstant: number = 60
): MergedCandidateChunk[] {
  const candidateMap = new Map<string, {
    chunk: DocumentChunk;
    retrievedByQueries: string[];
    scoresPerQuery: Record<string, number>;
    ranksPerQuery: Record<string, number>;
  }>();

  for (const resList of retrievalResults) {
    const qId = resList.queryId;

    resList.results.forEach((item, index) => {
      const chunkId = item.chunk.id;
      const rank = index + 1;

      let existing = candidateMap.get(chunkId);
      if (!existing) {
        existing = {
          chunk: item.chunk,
          retrievedByQueries: [],
          scoresPerQuery: {},
          ranksPerQuery: {},
        };
        candidateMap.set(chunkId, existing);
      }

      if (!existing.retrievedByQueries.includes(qId)) {
        existing.retrievedByQueries.push(qId);
      }
      existing.scoresPerQuery[qId] = item.score;
      existing.ranksPerQuery[qId] = rank;
    });
  }

  // Calculate Fusion Scores
  const merged: MergedCandidateChunk[] = [];
  for (const [_, data] of candidateMap.entries()) {
    let rrfScore = 0;
    for (const [qId, rank] of Object.entries(data.ranksPerQuery)) {
      rrfScore += 1 / (rrfKConstant + rank);
    }

    const scores = Object.values(data.scoresPerQuery);
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    let finalScore = rrfScore;
    if (fusionStrategy === 'max_score') finalScore = maxScore;
    else if (fusionStrategy === 'avg_score') finalScore = avgScore;

    merged.push({
      chunk: data.chunk,
      occurrences: data.retrievedByQueries.length,
      retrievedByQueries: data.retrievedByQueries,
      scoresPerQuery: data.scoresPerQuery,
      ranksPerQuery: data.ranksPerQuery,
      maxScore,
      avgScore,
      rrfScore,
      finalScore,
    });
  }

  return merged.sort((a, b) => b.finalScore - a.finalScore);
}
```

In the next chapter, we will look at the RAG Pipeline Orchestrator and LLM Synthesizer.
