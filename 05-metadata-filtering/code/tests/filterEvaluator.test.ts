import { FilterEvaluator } from '../src/filters/evaluator';
import { ChunkMetadata } from '../src/types/document.types';

describe('FilterEvaluator', () => {
  const sampleMetadata: ChunkMetadata = {
    document_id: 'doc_123',
    chunk_index: 0,
    tenant_id: 'tenant_A',
    department: 'finance',
    created_at: '2026-05-10',
    file_type: 'pdf',
    access_level: 3,
    is_public: false,
    tags: ['audit', 'q2'],
  };

  test('should return true for empty or undefined filter', () => {
    expect(FilterEvaluator.evaluate(sampleMetadata, undefined)).toBe(true);
    expect(FilterEvaluator.evaluate(sampleMetadata, {})).toBe(true);
  });

  test('should evaluate implicit and explicit equality ($eq)', () => {
    expect(FilterEvaluator.evaluate(sampleMetadata, { tenant_id: 'tenant_A' })).toBe(true);
    expect(FilterEvaluator.evaluate(sampleMetadata, { tenant_id: 'tenant_B' })).toBe(false);
    expect(FilterEvaluator.evaluate(sampleMetadata, { department: { $eq: 'finance' } })).toBe(true);
    expect(FilterEvaluator.evaluate(sampleMetadata, { department: { $eq: 'hr' } })).toBe(false);
  });

  test('should evaluate inequality ($ne)', () => {
    expect(FilterEvaluator.evaluate(sampleMetadata, { department: { $ne: 'hr' } })).toBe(true);
    expect(FilterEvaluator.evaluate(sampleMetadata, { department: { $ne: 'finance' } })).toBe(false);
  });

  test('should evaluate numeric and ISO date range comparisons ($gt, $gte, $lt, $lte)', () => {
    expect(FilterEvaluator.evaluate(sampleMetadata, { access_level: { $gte: 3 } })).toBe(true);
    expect(FilterEvaluator.evaluate(sampleMetadata, { access_level: { $gt: 3 } })).toBe(false);
    expect(FilterEvaluator.evaluate(sampleMetadata, { access_level: { $lte: 4 } })).toBe(true);

    expect(
      FilterEvaluator.evaluate(sampleMetadata, {
        created_at: { $gte: '2026-01-01', $lte: '2026-12-31' },
      })
    ).toBe(true);

    expect(
      FilterEvaluator.evaluate(sampleMetadata, {
        created_at: { $gt: '2026-06-01' },
      })
    ).toBe(false);
  });

  test('should evaluate set membership ($in, $nin)', () => {
    expect(
      FilterEvaluator.evaluate(sampleMetadata, {
        department: { $in: ['finance', 'engineering'] },
      })
    ).toBe(true);

    expect(
      FilterEvaluator.evaluate(sampleMetadata, {
        department: { $nin: ['finance', 'engineering'] },
      })
    ).toBe(false);
  });

  test('should evaluate array field containment ($contains)', () => {
    expect(FilterEvaluator.evaluate(sampleMetadata, { tags: { $contains: 'audit' } })).toBe(true);
    expect(FilterEvaluator.evaluate(sampleMetadata, { tags: { $contains: 'legal' } })).toBe(false);
  });

  test('should evaluate complex logical conditions ($and, $or, $not)', () => {
    expect(
      FilterEvaluator.evaluate(sampleMetadata, {
        $and: [{ tenant_id: 'tenant_A' }, { department: 'finance' }],
      })
    ).toBe(true);

    expect(
      FilterEvaluator.evaluate(sampleMetadata, {
        $or: [{ department: 'hr' }, { file_type: 'pdf' }],
      })
    ).toBe(true);

    expect(
      FilterEvaluator.evaluate(sampleMetadata, {
        $not: { department: 'hr' },
      })
    ).toBe(true);
  });
});
