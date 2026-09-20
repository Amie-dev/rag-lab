import { ScoreNormalizerType } from '../schemas';

export interface ScoreItem {
  id: string;
  score: number;
}

export class ScoreNormalizer {
  static normalize(items: ScoreItem[], method: ScoreNormalizerType): Map<string, number> {
    const normalized = new Map<string, number>();
    if (items.length === 0) return normalized;

    if (method === 'none') {
      items.forEach((item) => normalized.set(item.id, item.score));
      return normalized;
    }

    const scores = items.map((i) => i.score);

    switch (method) {
      case 'minmax': {
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const range = max - min;

        items.forEach((item) => {
          const normVal = range === 0 ? 1.0 : (item.score - min) / range;
          normalized.set(item.id, normVal);
        });
        break;
      }
      case 'zscore': {
        const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
        const std = Math.sqrt(variance);

        items.forEach((item) => {
          const z = std === 0 ? 0 : (item.score - mean) / std;
          // Apply Sigmoid function to map Z-score to range (0, 1)
          const sigmoid = 1 / (1 + Math.exp(-z));
          normalized.set(item.id, sigmoid);
        });
        break;
      }
      case 'softmax': {
        const maxScore = Math.max(...scores);
        const expScores = scores.map((s) => Math.exp(s - maxScore));
        const sumExp = expScores.reduce((sum, e) => sum + e, 0);

        items.forEach((item, idx) => {
          const prob = sumExp === 0 ? 1 / items.length : expScores[idx] / sumExp;
          normalized.set(item.id, prob);
        });
        break;
      }
      default:
        throw new Error(`Unsupported normalizer type: ${method}`);
    }

    return normalized;
  }
}
