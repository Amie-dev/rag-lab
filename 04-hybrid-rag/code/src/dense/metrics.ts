import { SimilarityMetric } from '../schemas.js';

export function computeCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  
  // Clamp cosine similarity between -1 and 1
  const sim = dot / denom;
  return Math.max(-1, Math.min(1, sim));
}

export function computeDotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

export function computeEuclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

export function computeDistance(a: number[], b: number[], metric: SimilarityMetric): { score: number; distance: number } {
  switch (metric) {
    case 'cosine': {
      const score = computeCosineSimilarity(a, b);
      // Cosine distance = 1 - Cosine similarity
      return { score, distance: 1 - score };
    }
    case 'dot_product': {
      const score = computeDotProduct(a, b);
      return { score, distance: -score };
    }
    case 'euclidean': {
      const dist = computeEuclideanDistance(a, b);
      // Map distance to a normalized similarity score in [0, 1]
      const score = 1 / (1 + dist);
      return { score, distance: dist };
    }
    default:
      throw new Error(`Unsupported metric: ${metric}`);
  }
}
