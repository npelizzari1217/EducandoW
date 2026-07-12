import { describe, it, expect } from 'vitest';
import { DomainError } from '@educandow/domain';
import { ApplicationError } from '../application-error';

// Local test-only subclass — production code exposes only abstract ApplicationError.
class TestError extends ApplicationError {
  constructor(message: string, code: string, httpStatus?: number) {
    super(message, code, httpStatus);
  }
}

describe('ApplicationError', () => {
  // AEM-R1.S1
  it('exposes message, code and httpStatus set explicitly by the subclass', () => {
    const err = new TestError('boom', 'SOME_CODE', 418);
    expect(err.message).toBe('boom');
    expect(err.code).toBe('SOME_CODE');
    expect(err.httpStatus).toBe(418);
  });

  // AEM-R1.S2
  it('defaults httpStatus to 422 when the subclass does not pass one to super()', () => {
    const err = new TestError('boom', 'SOME_CODE');
    expect(err.httpStatus).toBe(422);
  });

  // AEM-R1.S3
  it('is not an instance of DomainError', () => {
    const err = new TestError('boom', 'SOME_CODE');
    expect(err instanceof DomainError).toBe(false);
  });
});
