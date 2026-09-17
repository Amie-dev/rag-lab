import { SimilarityMetric } from '../schemas';

/**
 * Production-grade Vector Math Utility Functions
 */
export class VectorMath {
  /**
   * Computes the dot product of two vectors of equal dimension.
   */
  public static dotProduct(a: number[], b: number[]): number {
    this.assertMatchingDimensions(a, b);
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Computes the magnitude (L2 norm) of a vector.
   */
  public static magnitude(v: number[]): number {
    let sum = 0;
    for (let i = 0; i < v.length; i++) {
      sum += v[i] * v[i];
    }
    return Math.sqrt(sum);
  }

  /**
   * L2 Normalizes a vector so its magnitude equals 1.0.
   */
  public static l2Normalize(v: number[]): number[] {
    const mag = this.magnitude(v);
    if (mag === 0) return [...v];
    return v.map((val) => val / mag);
  }

  /**
   * Computes Cosine Similarity between two vectors: (A · B) / (||A|| * ||B||).
   * Returns a value between -1.0 and 1.0.
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    this.assertMatchingDimensions(a, b);
    const magA = this.magnitude(a);
    const magB = this.magnitude(b);

    if (magA === 0 || magB === 0) {
      return 0;
    }

    const dot = this.dotProduct(a, b);
    const similarity = dot / (magA * magB);
    // Clamp rounding errors
    return Math.max(-1, Math.min(1, similarity));
  }

  /**
   * Computes Euclidean (L2) distance between two vectors: sqrt(sum((a_i - b_i)^2)).
   */
  public static euclideanDistance(a: number[], b: number[]): number {
    this.assertMatchingDimensions(a, b);
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Computes Manhattan (L1) distance between two vectors: sum(|a_i - b_i|).
   */
  public static manhattanDistance(a: number[], b: number[]): number {
    this.assertMatchingDimensions(a, b);
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.abs(a[i] - b[i]);
    }
    return sum;
  }

  /**
   * Computes distance metric according to the metric type.
   * Lower distance means closer/more similar for distance metrics,
   * higher similarity value means closer for similarity metrics.
   */
  public static computeDistance(
    a: number[],
    b: number[],
    metric: SimilarityMetric = 'cosine'
  ): number {
    switch (metric) {
      case 'cosine':
        // Cosine distance = 1 - cosine similarity
        return 1 - this.cosineSimilarity(a, b);
      case 'dot_product':
        // Negative dot product so lower value means higher dot product
        return -this.dotProduct(a, b);
      case 'euclidean':
        return this.euclideanDistance(a, b);
      case 'manhattan':
        return this.manhattanDistance(a, b);
      default:
        throw new Error(`Unsupported similarity metric: ${metric}`);
    }
  }

  /**
   * Converts raw distance or raw metric score into a normalized similarity score [0, 1].
   */
  public static distanceToScore(rawVal: number, metric: SimilarityMetric): number {
    switch (metric) {
      case 'cosine':
        // rawVal is cosine similarity (-1 to 1) or cosine distance (0 to 2)
        // If passed raw similarity score
        if (rawVal >= -1 && rawVal <= 1) {
          return (rawVal + 1) / 2;
        }
        // If passed cosine distance
        return Math.max(0, 1 - rawVal / 2);
      case 'dot_product':
        // Sigmoid mapping for dot product
        return 1 / (1 + Math.exp(-rawVal));
      case 'euclidean':
      case 'manhattan':
        // Exponential decay mapping 1 / (1 + distance)
        return 1 / (1 + rawVal);
      default:
        return 0;
    }
  }

  private static assertMatchingDimensions(a: number[], b: number[]): void {
    if (a.length !== b.length) {
      throw new Error(
        `Vector dimension mismatch: vector A dimension ${a.length} does not match vector B dimension ${b.length}`
      );
    }
  }
}
