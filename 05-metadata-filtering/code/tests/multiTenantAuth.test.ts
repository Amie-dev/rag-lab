import { SecurityFilterBuilder } from '../src/filters/securityFilter';
import { AuthenticatedUser } from '../src/types/api.types';

describe('SecurityFilterBuilder', () => {
  const mockUser: AuthenticatedUser = {
    user_id: 'usr_123',
    tenant_id: 'tenant_A',
    department: 'finance',
    departments: ['finance', 'accounting'],
    access_level: 2,
  };

  test('should inject mandatory tenant_id and access_level constraints', () => {
    const filter = SecurityFilterBuilder.buildAuthorizedFilter(mockUser);

    expect(filter.$and).toBeDefined();
    expect(filter.$and).toContainEqual({ tenant_id: 'tenant_A' });
    expect(filter.$and).toContainEqual({
      $or: [{ is_public: true }, { access_level: { $lte: 2 } }],
    });
  });

  test('should sanitize client attempts to override tenant_id', () => {
    const maliciousClientFilter = {
      tenant_id: 'tenant_B_ATTEMPTED_OVERRIDE',
      file_type: 'pdf',
    };

    const filter = SecurityFilterBuilder.buildAuthorizedFilter(mockUser, maliciousClientFilter);

    // Ensure tenant_id in top-level $and is tenant_A
    expect(filter.$and).toContainEqual({ tenant_id: 'tenant_A' });

    // Ensure client filter passed was sanitized (file_type present, tenant_id removed)
    expect(filter.$and).toContainEqual({ file_type: 'pdf' });
    expect(filter.$and).not.toContainEqual({ tenant_id: 'tenant_B_ATTEMPTED_OVERRIDE' });
  });
});
