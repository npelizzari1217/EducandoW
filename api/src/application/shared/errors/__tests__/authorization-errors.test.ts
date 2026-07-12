import { describe, it, expect } from 'vitest';
import {
  InsufficientRoleHierarchyError,
  CrossInstitutionForbiddenError,
} from '../authorization-errors';

describe('InsufficientRoleHierarchyError', () => {
  // AEM-R3.S1
  it('has fixed code and httpStatus regardless of message', () => {
    const err = new InsufficientRoleHierarchyError('some message');
    expect(err.code).toBe('INSUFFICIENT_ROLE_HIERARCHY');
    expect(err.httpStatus).toBe(403);
    expect(err.message).toBe('some message');
  });
});

describe('CrossInstitutionForbiddenError', () => {
  // AEM-R3.S2
  it('has fixed code and httpStatus regardless of message', () => {
    const err = new CrossInstitutionForbiddenError('some message');
    expect(err.code).toBe('CROSS_INSTITUTION_FORBIDDEN');
    expect(err.httpStatus).toBe(403);
    expect(err.message).toBe('some message');
  });
});
