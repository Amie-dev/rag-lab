import { RankCorrelationResult } from '../schemas';

export class RankCorrelationAnalyzer {
  static analyze(denseItemIds: string[], sparseItemIds: string[]): RankCorrelationResult {
    const denseSet = new Set(denseItemIds);
    const sparseSet = new Set(sparseItemIds);

    // Common items present in both lists
    const common = denseItemIds.filter((id) => sparseSet.has(id));
    const commonCount = common.length;

    // Jaccard similarity: |A ∩ B| / |A ∪ B|
    const unionSet = new Set([...denseItemIds, ...sparseItemIds]);
    const jaccard = unionSet.size === 0 ? 0 : commonCount / unionSet.size;

    if (commonCount < 2) {
      return {
        kendallTau: 0,
        spearmanRho: 0,
        commonItemCount: commonCount,
        jaccardSimilarity: jaccard
      };
    }

    // Rank maps for common items
    const denseRankMap = new Map<string, number>();
    denseItemIds.forEach((id, idx) => denseRankMap.set(id, idx + 1));

    const sparseRankMap = new Map<string, number>();
    sparseItemIds.forEach((id, idx) => sparseRankMap.set(id, idx + 1));

    // Kendall's Tau calculation on common pairs
    let concordant = 0;
    let discordant = 0;

    for (let i = 0; i < commonCount; i++) {
      for (let j = i + 1; j < commonCount; j++) {
        const itemA = common[i];
        const itemB = common[j];

        const denseDiff = denseRankMap.get(itemA)! - denseRankMap.get(itemB)!;
        const sparseDiff = sparseRankMap.get(itemA)! - sparseRankMap.get(itemB)!;

        if (denseDiff * sparseDiff > 0) {
          concordant++;
        } else if (denseDiff * sparseDiff < 0) {
          discordant++;
        }
      }
    }

    const totalPairs = (commonCount * (commonCount - 1)) / 2;
    const kendallTau = totalPairs === 0 ? 0 : (concordant - discordant) / totalPairs;

    // Spearman's Rho calculation on common items
    let sumD2 = 0;
    for (const item of common) {
      const d = denseRankMap.get(item)! - sparseRankMap.get(item)!;
      sumD2 += d * d;
    }
    const spearmanRho = 1 - (6 * sumD2) / (commonCount * (Math.pow(commonCount, 2) - 1));

    return {
      kendallTau: isNaN(kendallTau) ? 0 : kendallTau,
      spearmanRho: isNaN(spearmanRho) ? 0 : spearmanRho,
      commonItemCount: commonCount,
      jaccardSimilarity: jaccard
    };
  }
}
