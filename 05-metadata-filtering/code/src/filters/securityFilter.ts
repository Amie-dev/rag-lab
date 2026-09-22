/**
 * Security Filter Builder
 * Enforces Multi-Tenant Isolation and Access Control Policy Guards.
 */

import { AuthenticatedUser } from '../types/api.types';
import { MetadataFilter } from '../types/filter.types';

export class SecurityFilterBuilder {
  /**
   * Constructs an authorized MetadataFilter by combining tenant isolation and
   * permission constraints with any optional client-supplied query filter.
   */
  public static buildAuthorizedFilter(
    user: AuthenticatedUser,
    clientFilter?: MetadataFilter
  ): MetadataFilter {
    const securityConstraints: MetadataFilter[] = [];

    // 1. Mandatory Tenant Isolation Guard
    securityConstraints.push({
      tenant_id: user.tenant_id,
    });

    // 2. Access Level & Public Access Guard:
    // Content is accessible if (access_level <= user.access_level) OR (is_public == true)
    securityConstraints.push({
      $or: [
        { is_public: true },
        { access_level: { $lte: user.access_level } },
      ],
    });

    // 3. Department Boundary Guard (if user belongs to specific department(s))
    if (user.departments && user.departments.length > 0) {
      securityConstraints.push({
        $or: [
          { is_public: true },
          { department: { $in: user.departments } },
          { department: { $eq: undefined } }, // General company documents
        ],
      });
    }

    // Combine security constraints with client-supplied filter
    if (clientFilter && Object.keys(clientFilter).length > 0) {
      // Sanitize client filter: strip any attempt to override tenant_id directly
      const sanitizedClientFilter = this.sanitizeClientFilter(clientFilter);
      securityConstraints.push(sanitizedClientFilter);
    }

    return {
      $and: securityConstraints,
    };
  }

  /**
   * Removes client attempts to spoof tenant_id or bypass authorization boundaries.
   */
  private static sanitizeClientFilter(filter: MetadataFilter): MetadataFilter {
    const copy = JSON.parse(JSON.stringify(filter)) as MetadataFilter;

    // Delete direct tenant_id key from client filter to prevent tenant escalation
    if ('tenant_id' in copy) {
      delete copy.tenant_id;
    }

    return copy;
  }
}
