/**
 * PresenteTypeNotFoundError — Strict TDD (RED first).
 * Satisfies: ATR-R11.5 (nivel sin AttendanceType Presente configurado).
 * Same pattern as PreviousMonthOpenError (asistencia/errors/attendance-month-status.errors.ts).
 */
import { describe, it, expect } from 'vitest';
import { DomainError } from '../../../shared/errors/domain-error';
import { PresenteTypeNotFoundError } from '../../errors/presente-type-not-found-error';

describe('PresenteTypeNotFoundError', () => {
  it('has code PRESENTE_TYPE_NOT_FOUND and a descriptive message including level and courseCycleId', () => {
    const e = new PresenteTypeNotFoundError(3, 'cc-uuid-1');
    expect(e.code).toBe('PRESENTE_TYPE_NOT_FOUND');
    expect(e.message).toContain('3');
    expect(e.message).toContain('cc-uuid-1');
  });

  it('is an instance of DomainError and Error', () => {
    const e = new PresenteTypeNotFoundError(3, 'cc-uuid-1');
    expect(e).toBeInstanceOf(DomainError);
    expect(e).toBeInstanceOf(Error);
  });
});
