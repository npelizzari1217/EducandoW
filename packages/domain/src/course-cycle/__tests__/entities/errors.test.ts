import { describe, it, expect } from 'vitest';
import {
  CourseCycleClosedError,
  CourseCycleAlreadyExistsError,
  CourseCycleNotFoundError,
  BimonthPeriodInvalidError,
} from '../../errors';

describe('CourseCycleClosedError', () => {
  it('has correct code and descriptive message', () => {
    const err = new CourseCycleClosedError('abc-123');
    expect(err.code).toBe('COURSE_CYCLE_CLOSED');
    expect(err.message).toContain('abc-123');
    expect(err.message).toContain('closed');
  });
});

describe('CourseCycleAlreadyExistsError', () => {
  it('has correct code and message', () => {
    const err = new CourseCycleAlreadyExistsError('course-x', 'cycle-y');
    expect(err.code).toBe('COURSE_CYCLE_ALREADY_EXISTS');
    expect(err.message).toContain('course-x');
    expect(err.message).toContain('cycle-y');
  });
});

describe('CourseCycleNotFoundError', () => {
  it('has correct code and message', () => {
    const err = new CourseCycleNotFoundError('uuid-xyz');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('CourseCycle');
    expect(err.message).toContain('uuid-xyz');
  });
});

describe('BimonthPeriodInvalidError', () => {
  it('has correct code and message', () => {
    const err = new BimonthPeriodInvalidError('first');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toContain('first');
    expect(err.message).toContain('bimonth');
  });
});
