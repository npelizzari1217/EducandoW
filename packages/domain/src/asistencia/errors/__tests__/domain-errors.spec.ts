/**
 * Domain error unit tests — Strict TDD
 * Satisfies: REQ-GUARD-1, REQ-GUARD-2, REQ-GUARD-3; AC-07, AC-08, AC-09
 * Scenarios: GUARD-1..GUARD-9 (error class assertions)
 */
import { describe, it, expect } from 'vitest';
import { DomainError } from '../../../shared/errors/domain-error';
import { DayNotAssignableError } from '../day-not-assignable-error';
import { StatusNotAssignableError } from '../status-not-assignable-error';

describe('DayNotAssignableError', () => {
  const err = new DayNotAssignableError('day 4 (1/2025) is a Saturday and cannot be recorded');

  it('is an instance of DomainError', () => {
    expect(err).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    expect(err).toBeInstanceOf(Error);
  });

  it('has code DAY_NOT_ASSIGNABLE', () => {
    expect(err.code).toBe('DAY_NOT_ASSIGNABLE');
  });

  it('message contains the supplied string', () => {
    expect(err.message).toContain('day 4 (1/2025) is a Saturday and cannot be recorded');
  });

  it('carries code through the constructor without a second argument', () => {
    const e = new DayNotAssignableError('some message');
    expect(e.code).toBe('DAY_NOT_ASSIGNABLE');
  });
});

describe('StatusNotAssignableError', () => {
  const err = new StatusNotAssignableError('statusCode "SAB" is not assignable');

  it('is an instance of DomainError', () => {
    expect(err).toBeInstanceOf(DomainError);
  });

  it('is an instance of Error', () => {
    expect(err).toBeInstanceOf(Error);
  });

  it('has code STATUS_NOT_ASSIGNABLE', () => {
    expect(err.code).toBe('STATUS_NOT_ASSIGNABLE');
  });

  it('message contains the supplied string', () => {
    expect(err.message).toContain('statusCode "SAB" is not assignable');
  });

  it('carries code through the constructor without a second argument', () => {
    const e = new StatusNotAssignableError('some message');
    expect(e.code).toBe('STATUS_NOT_ASSIGNABLE');
  });
});

describe('Type safety — errors are distinct', () => {
  it('DayNotAssignableError is NOT instanceof StatusNotAssignableError', () => {
    const err = new DayNotAssignableError('day error');
    expect(err).not.toBeInstanceOf(StatusNotAssignableError);
  });

  it('StatusNotAssignableError is NOT instanceof DayNotAssignableError', () => {
    const err = new StatusNotAssignableError('status error');
    expect(err).not.toBeInstanceOf(DayNotAssignableError);
  });

  it('both are instanceof DomainError (shared base)', () => {
    const dayErr = new DayNotAssignableError('day error');
    const statusErr = new StatusNotAssignableError('status error');
    expect(dayErr).toBeInstanceOf(DomainError);
    expect(statusErr).toBeInstanceOf(DomainError);
  });
});
