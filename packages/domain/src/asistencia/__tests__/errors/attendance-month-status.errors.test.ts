/**
 * Domain errors for Capacidad B (cierre mensual de asistencia). Strict TDD (RED first).
 * Satisfies: AC-B-4, AC-B-5, AC-B-6, AC-B-8.
 */
import { describe, it, expect } from 'vitest';
import { DomainError } from '../../../shared/errors/domain-error';
import { MonthClosedError } from '../../errors/attendance-month-status.errors';
import { PreviousMonthOpenError } from '../../errors/attendance-month-status.errors';

describe('MonthClosedError', () => {
  it('has code MONTH_CLOSED and a descriptive message', () => {
    const e = new MonthClosedError('cc-uuid-1', 2026, 3);
    expect(e.code).toBe('MONTH_CLOSED');
    expect(e.message).toContain('cc-uuid-1');
    expect(e.message).toContain('3');
    expect(e.message).toContain('2026');
  });

  it('is an instance of DomainError and Error', () => {
    const e = new MonthClosedError('cc-uuid-1', 2026, 3);
    expect(e).toBeInstanceOf(DomainError);
    expect(e).toBeInstanceOf(Error);
  });
});

describe('PreviousMonthOpenError', () => {
  it('has code PREVIOUS_MONTH_OPEN and a descriptive message', () => {
    const e = new PreviousMonthOpenError('cc-uuid-1', 2026, 3);
    expect(e.code).toBe('PREVIOUS_MONTH_OPEN');
    expect(e.message).toContain('cc-uuid-1');
    expect(e.message).toContain('3');
    expect(e.message).toContain('2026');
  });

  it('is an instance of DomainError and Error', () => {
    const e = new PreviousMonthOpenError('cc-uuid-1', 2026, 3);
    expect(e).toBeInstanceOf(DomainError);
    expect(e).toBeInstanceOf(Error);
  });
});

describe('Type safety — errors are distinct', () => {
  it('MonthClosedError is NOT instanceof PreviousMonthOpenError and vice versa', () => {
    const monthClosed = new MonthClosedError('cc-uuid-1', 2026, 3);
    const previousOpen = new PreviousMonthOpenError('cc-uuid-1', 2026, 3);
    expect(monthClosed).not.toBeInstanceOf(PreviousMonthOpenError);
    expect(previousOpen).not.toBeInstanceOf(MonthClosedError);
  });
});
