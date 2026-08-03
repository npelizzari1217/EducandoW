import { describe, it, expect } from 'vitest';
import { DomainError } from '@educandow/domain';
import { ApplicationError } from '../application-error';
import { ForbiddenError } from '../forbidden-error';

describe('ForbiddenError', () => {
  it('is an ApplicationError, not a DomainError, with fixed code and 403', () => {
    const error = new ForbiddenError();
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error).not.toBeInstanceOf(DomainError);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.httpStatus).toBe(403);
    expect(error.message).toBe('Forbidden');
  });

  it('accepts a custom message and keeps code/status fixed', () => {
    const error = new ForbiddenError('No estás asignado a esta materia');
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.httpStatus).toBe(403);
    expect(error.message).toBe('No estás asignado a esta materia');
  });
});
