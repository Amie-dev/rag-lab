import { VectorMath } from '../src/math/vectorMath';

describe('VectorMath Utility Suite', () => {
  it('should compute exact dot product', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    expect(VectorMath.dotProduct(a, b)).toBe(32);
  });

  it('should compute vector magnitude and normalize to unit vector', () => {
    const v = [3, 4];
    expect(VectorMath.magnitude(v)).toBe(5);

    const norm = VectorMath.l2Normalize(v);
    expect(norm[0]).toBeCloseTo(0.6);
    expect(norm[1]).toBeCloseTo(0.8);
    expect(VectorMath.magnitude(norm)).toBeCloseTo(1.0);
  });

  it('should compute exact cosine similarity for identical and orthogonal vectors', () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    const v3 = [0, 1, 0];

    expect(VectorMath.cosineSimilarity(v1, v2)).toBeCloseTo(1.0);
    expect(VectorMath.cosineSimilarity(v1, v3)).toBeCloseTo(0.0);
  });

  it('should compute exact Euclidean and Manhattan distance', () => {
    const a = [0, 0];
    const b = [3, 4];

    expect(VectorMath.euclideanDistance(a, b)).toBe(5);
    expect(VectorMath.manhattanDistance(a, b)).toBe(7);
  });

  it('should throw error on dimension mismatch', () => {
    const a = [1, 2];
    const b = [1, 2, 3];

    expect(() => VectorMath.dotProduct(a, b)).toThrow(/Vector dimension mismatch/);
  });
});
