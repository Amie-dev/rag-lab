import { HybridRetrievalResult } from '../schemas';

export class FusionExplainer {
  static formatExplanation(result: HybridRetrievalResult): string {
    const { explanation, chunk, finalRank, finalScore } = result;

    const lines: string[] = [
      `Rank #${finalRank} | Chunk ID: ${chunk.id} | Final Hybrid Score: ${finalScore.toFixed(6)}`,
      `Strategy: ${explanation.strategyUsed.toUpperCase()}`,
      `Formula: ${explanation.mathematicalFormula}`,
      `Details:`
    ];

    if (explanation.denseRank !== null) {
      lines.push(
        `  • Dense Vector Search : Rank ${explanation.denseRank} | Raw Score: ${explanation.denseRawScore?.toFixed(4) ?? 'N/A'}` +
          (explanation.denseNormalizedScore !== null ? ` | Norm Score: ${explanation.denseNormalizedScore.toFixed(4)}` : '') +
          (explanation.denseRrfContribution !== null ? ` | RRF Contrib: ${explanation.denseRrfContribution.toFixed(6)}` : '')
      );
    } else {
      lines.push(`  • Dense Vector Search : Not in top dense candidates`);
    }

    if (explanation.sparseRank !== null) {
      lines.push(
        `  • Sparse BM25 Search  : Rank ${explanation.sparseRank} | Raw Score: ${explanation.sparseRawScore?.toFixed(4) ?? 'N/A'}` +
          (explanation.sparseNormalizedScore !== null ? ` | Norm Score: ${explanation.sparseNormalizedScore.toFixed(4)}` : '') +
          (explanation.sparseRrfContribution !== null ? ` | RRF Contrib: ${explanation.sparseRrfContribution.toFixed(6)}` : '')
      );
    } else {
      lines.push(`  • Sparse BM25 Search  : Not in top sparse candidates`);
    }

    lines.push(`Content Snippet: "${chunk.content.slice(0, 120).replace(/\n/g, ' ')}..."`);
    return lines.join('\n');
  }

  static formatAll(results: HybridRetrievalResult[]): string {
    return results.map((r, i) => `--- [ Candidate ${i + 1} ] ---\n${this.formatExplanation(r)}`).join('\n\n');
  }
}
