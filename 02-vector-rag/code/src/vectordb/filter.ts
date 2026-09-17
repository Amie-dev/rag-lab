import { MetadataFilter, VectorRecord } from '../schemas';

/**
 * Production-grade Metadata Payload Filter Evaluator
 */
export class MetadataFilterEvaluator {
  /**
   * Evaluates whether a VectorRecord satisfies a given metadata filter query.
   */
  public static evaluate(record: VectorRecord, filter?: MetadataFilter): boolean {
    if (!filter || Object.keys(filter).length === 0) {
      return true;
    }

    const metadata = { ...record.metadata, ...record.chunk?.metadata };

    for (const [key, value] of Object.entries(filter)) {
      if (key === '$and') {
        const subFilters = value as MetadataFilter[];
        if (!subFilters.every((sub) => this.evaluate(record, sub))) {
          return false;
        }
        continue;
      }

      if (key === '$or') {
        const subFilters = value as MetadataFilter[];
        if (!subFilters.some((sub) => this.evaluate(record, sub))) {
          return false;
        }
        continue;
      }

      const fieldValue = metadata[key];

      // Direct equality match
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        if (Array.isArray(value)) {
          if (!value.includes(fieldValue as any)) return false;
        } else if (fieldValue !== value) {
          return false;
        }
        continue;
      }

      // Comparison operator dictionary
      const condition = value as Record<string, unknown>;
      for (const [op, val] of Object.entries(condition)) {
        switch (op) {
          case '$eq':
            if (fieldValue !== val) return false;
            break;
          case '$ne':
            if (fieldValue === val) return false;
            break;
          case '$gt':
            if (typeof fieldValue !== 'number' || fieldValue <= (val as number)) return false;
            break;
          case '$gte':
            if (typeof fieldValue !== 'number' || fieldValue < (val as number)) return false;
            break;
          case '$lt':
            if (typeof fieldValue !== 'number' || fieldValue >= (val as number)) return false;
            break;
          case '$lte':
            if (typeof fieldValue !== 'number' || fieldValue > (val as number)) return false;
            break;
          case '$in':
            if (!Array.isArray(val) || !val.includes(fieldValue as any)) return false;
            break;
          case '$nin':
            if (Array.isArray(val) && val.includes(fieldValue as any)) return false;
            break;
          default:
            throw new Error(`Unsupported filter operator: ${op}`);
        }
      }
    }

    return true;
  }
}
