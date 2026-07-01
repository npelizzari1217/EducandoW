import { describe, it, expect } from 'vitest';
import {
  GradingPhaseViolationError,
  GradingPhaseNotApplicableError,
} from '../../errors/grading-phase.errors';

describe('GradingPhaseViolationError', () => {
  it('has code GRADING_PHASE_VIOLATION and a descriptive message', () => {
    const e = new GradingPhaseViolationError('cc-uuid-1', 'Attempted to grade bimester 2 while phase is BIM_1');
    expect(e.code).toBe('GRADING_PHASE_VIOLATION');
    expect(e.message).toContain('cc-uuid-1');
    expect(e.message).toContain('bimester 2');
  });

  it('is an Error instance', () => {
    const e = new GradingPhaseViolationError('cc-uuid-1', 'reason');
    expect(e).toBeInstanceOf(Error);
  });
});

describe('GradingPhaseNotApplicableError', () => {
  it('has code GRADING_PHASE_NOT_APPLICABLE and a descriptive message', () => {
    const e = new GradingPhaseNotApplicableError('cc-uuid-2');
    expect(e.code).toBe('GRADING_PHASE_NOT_APPLICABLE');
    expect(e.message).toContain('cc-uuid-2');
  });

  it('is an Error instance', () => {
    const e = new GradingPhaseNotApplicableError('cc-uuid-2');
    expect(e).toBeInstanceOf(Error);
  });
});
