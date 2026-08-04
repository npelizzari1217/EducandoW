import { describe, it, expect } from 'vitest';
import { DomainError } from '@educandow/domain';
import { ApplicationError } from '../application-error';
import { InfrastructureError } from '../infrastructure-error';

// Local concrete stub — production code exposes only abstract InfrastructureError.
class StubInfraError extends InfrastructureError {
  constructor() {
    super('msg', 'STUB_CODE');
  }
}

describe('InfrastructureError', () => {
  // IEM-R1.S4
  it('is an instance of Error', () => {
    const err = new StubInfraError();
    expect(err instanceof Error).toBe(true);
  });

  // IEM-R1.S3
  it('is not an instance of ApplicationError or DomainError', () => {
    const err = new StubInfraError();
    expect(err instanceof ApplicationError).toBe(false);
    expect(err instanceof DomainError).toBe(false);
  });

  // IEM-R1.S2
  it('has a fixed httpStatus of 500, not overridable by the subclass', () => {
    const err = new StubInfraError();
    expect(err.httpStatus).toBe(500);
  });

  // IEM-R1.S1
  it('exposes message, code and name set by the constructor', () => {
    const err = new StubInfraError();
    expect(err.message).toBe('msg');
    expect(err.code).toBe('STUB_CODE');
    expect(err.name).toBe('StubInfraError');
  });
});
