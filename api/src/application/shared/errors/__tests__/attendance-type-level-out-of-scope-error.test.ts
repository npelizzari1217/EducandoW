import { describe, it, expect } from 'vitest';
import { DomainError } from '@educandow/domain';
import { ApplicationError } from '../application-error';
import { AttendanceTypeLevelOutOfScopeError } from '../attendance-type-level-out-of-scope-error';

describe('AttendanceTypeLevelOutOfScopeError', () => {
  // ATRM-R1.S1
  it('is an ApplicationError, not a DomainError, with fixed code and 403', () => {
    const error = new AttendanceTypeLevelOutOfScopeError(3);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).not.toBeInstanceOf(DomainError);
    expect(error.code).toBe('ATTENDANCE_TYPE_LEVEL_OUT_OF_SCOPE');
    expect(error.httpStatus).toBe(403);
    expect(error.message).toContain('3');
  });

  it('builds the generic message when no level is passed', () => {
    const error = new AttendanceTypeLevelOutOfScopeError();
    expect(error.httpStatus).toBe(403);
    expect(error.message).toBe("AttendanceType level is out of the caller's access scope");
  });
});
