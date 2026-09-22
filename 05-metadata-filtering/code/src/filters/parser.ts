/**
 * Metadata Filter Parser & Helper Utilities
 */

import { MetadataFilter } from '../types/filter.types.js';

export class FilterParser {
  /**
   * Safely parses a JSON filter payload or string into a validated MetadataFilter.
   */
  public static parse(input: unknown): MetadataFilter | undefined {
    if (!input) return undefined;

    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input);
        return typeof parsed === 'object' && parsed !== null ? (parsed as MetadataFilter) : undefined;
      } catch {
        throw new Error('Invalid JSON string provided for metadata filter');
      }
    }

    if (typeof input === 'object' && input !== null) {
      return input as MetadataFilter;
    }

    return undefined;
  }

  /**
   * Helper to build equality filter
   */
  public static eq(field: string, value: string | number | boolean): MetadataFilter {
    return { [field]: value };
  }

  /**
   * Helper to build range filter
   */
  public static range(
    field: string,
    min?: number | string,
    max?: number | string
  ): MetadataFilter {
    const condition: Record<string, number | string> = {};
    if (min !== undefined) condition.$gte = min;
    if (max !== undefined) condition.$lte = max;
    return { [field]: condition };
  }

  /**
   * Helper to build set membership filter
   */
  public static in(field: string, values: Array<string | number>): MetadataFilter {
    return { [field]: { $in: values } };
  }
}
