/**
 * Inverse Document Frequency (IDF) Calculation Variants
 */

/**
 * Robertson BM25 IDF formulation:
 * IDF(q_i) = ln( (N - n(q_i) + 0.5) / (n(q_i) + 0.5) + 1 )
 *
 * Includes an optional epsilon floor to handle common terms without producing zero or negative scores.
 */
export function calculateBM25IDF(
  docCount: number,
  docFreq: number,
  epsilon: number = 0.25
): number {
  if (docCount === 0 || docFreq === 0) return 0;

  // Robertson formula with +1 inside ln to guarantee positivity
  const rawIdf = Math.log((docCount - docFreq + 0.5) / (docFreq + 0.5) + 1.0);

  // If rawIdf is negative or smaller than epsilon * average IDF, cap at floor value
  return rawIdf < 0 ? epsilon : Math.max(rawIdf, epsilon);
}

/**
 * Standard Smooth IDF:
 * IDF(q_i) = ln( (N + 1) / (n(q_i) + 1) ) + 1
 */
export function calculateSmoothIDF(docCount: number, docFreq: number): number {
  if (docCount === 0) return 0;
  return Math.log((docCount + 1) / (docFreq + 1)) + 1.0;
}

/**
 * Standard Probabilistic IDF:
 * IDF(q_i) = ln( (N - n(q_i)) / n(q_i) )
 */
export function calculateProbabilisticIDF(docCount: number, docFreq: number): number {
  if (docCount === 0 || docFreq === 0 || docCount <= docFreq) return 0;
  return Math.log((docCount - docFreq) / docFreq);
}
