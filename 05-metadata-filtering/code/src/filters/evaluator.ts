/**
 * Metadata Filter Evaluator
 * Evaluates document/chunk metadata against structured boolean filter expressions.
 */

import { ChunkMetadata } from '../types/document.types';
import { ConditionFilter, FilterValue, MetadataFilter } from '../types/filter.types';

export class FilterEvaluator {
  /**
   * Main entry point: checks if metadata matches the filter.
   */
  public static evaluate(metadata: ChunkMetadata, filter?: MetadataFilter): boolean {
    if (!filter || Object.keys(filter).length === 0) {
      return true;
    }

    // Process logical $and
    if (filter.$and && Array.isArray(filter.$and)) {
      const andMatch = filter.$and.every((subFilter) =>
        this.evaluate(metadata, subFilter)
      );
      if (!andMatch) return false;
    }

    // Process logical $or
    if (filter.$or && Array.isArray(filter.$or)) {
      const orMatch = filter.$or.some((subFilter) =>
        this.evaluate(metadata, subFilter)
      );
      if (!orMatch) return false;
    }

    // Process logical $not
    if (filter.$not && typeof filter.$not === 'object') {
      const notMatch = !this.evaluate(metadata, filter.$not);
      if (!notMatch) return false;
    }

    // Process field-level conditions
    for (const [key, filterExpr] of Object.entries(filter)) {
      if (key === '$and' || key === '$or' || key === '$not') {
        continue;
      }

      if (filterExpr === undefined) {
        continue;
      }

      const fieldValue = metadata[key];

      if (!this.evaluateField(fieldValue, filterExpr as FilterValue | ConditionFilter)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluates a single metadata field against a value or conditional filter object.
   */
  private static evaluateField(
    fieldValue: unknown,
    filterExpr: FilterValue | ConditionFilter
  ): boolean {
    // If filterExpr is a primitive or array directly (implicit $eq / $in)
    if (
      typeof filterExpr !== 'object' ||
      filterExpr === null ||
      Array.isArray(filterExpr)
    ) {
      return this.compareEq(fieldValue, filterExpr);
    }

    // At this point filterExpr is a ConditionFilter object like { $gte: 10, $lt: 50 }
    const condition = filterExpr as ConditionFilter;
    let isMatch = true;

    for (const [operator, operand] of Object.entries(condition)) {
      if (operand === undefined) continue;

      switch (operator) {
        case '$eq':
          isMatch = this.compareEq(fieldValue, operand);
          break;
        case '$ne':
          isMatch = !this.compareEq(fieldValue, operand);
          break;
        case '$gt':
          isMatch = this.compareRange(fieldValue, operand, (a, b) => a > b);
          break;
        case '$gte':
          isMatch = this.compareRange(fieldValue, operand, (a, b) => a >= b);
          break;
        case '$lt':
          isMatch = this.compareRange(fieldValue, operand, (a, b) => a < b);
          break;
        case '$lte':
          isMatch = this.compareRange(fieldValue, operand, (a, b) => a <= b);
          break;
        case '$in':
          isMatch = this.compareIn(fieldValue, operand);
          break;
        case '$nin':
          isMatch = !this.compareIn(fieldValue, operand);
          break;
        case '$contains':
          isMatch = this.compareContains(fieldValue, operand);
          break;
        default:
          throw new Error(`Unsupported filter operator: ${operator}`);
      }

      if (!isMatch) return false;
    }

    return true;
  }

  /**
   * Equality comparison ($eq)
   */
  private static compareEq(fieldValue: unknown, operand: unknown): boolean {
    if (fieldValue === operand) return true;

    // Handle array field values (e.g. metadata.tags = ['hr', 'policy'] vs operand = 'hr')
    if (Array.isArray(fieldValue)) {
      return fieldValue.includes(operand);
    }

    // Handle date string equality
    if (typeof fieldValue === 'string' && typeof operand === 'string') {
      return fieldValue === operand;
    }

    return false;
  }

  /**
   * Range comparison ($gt, $gte, $lt, $lte) supporting numbers and ISO dates
   */
  private static compareRange(
    fieldValue: unknown,
    operand: unknown,
    comparator: (a: number, b: number) => boolean
  ): boolean {
    if (fieldValue === undefined || fieldValue === null) return false;

    // Number comparison
    if (typeof fieldValue === 'number' && typeof operand === 'number') {
      return comparator(fieldValue, operand);
    }

    // Date comparison (ISO 8601 strings or timestamp numbers)
    if (typeof fieldValue === 'string' && typeof operand === 'string') {
      const dateA = Date.parse(fieldValue);
      const dateB = Date.parse(operand);
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return comparator(dateA, dateB);
      }
      // String lexicographical fallback
      return comparator(fieldValue.localeCompare(operand), 0);
    }

    return false;
  }

  /**
   * Set membership ($in)
   */
  private static compareIn(fieldValue: unknown, operand: unknown): boolean {
    if (!Array.isArray(operand)) {
      return false;
    }

    if (fieldValue === undefined || fieldValue === null) return false;

    if (Array.isArray(fieldValue)) {
      // Intersection check
      return fieldValue.some((val) => operand.includes(val as never));
    }

    return operand.includes(fieldValue as never);
  }

  /**
   * Containment check ($contains)
   */
  private static compareContains(fieldValue: unknown, operand: unknown): boolean {
    if (fieldValue === undefined || fieldValue === null) return false;

    if (Array.isArray(fieldValue)) {
      return fieldValue.includes(operand);
    }

    if (typeof fieldValue === 'string' && typeof operand === 'string') {
      return fieldValue.toLowerCase().includes(operand.toLowerCase());
    }

    return false;
  }
}
