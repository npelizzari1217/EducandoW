/**
 * unwrapResultOrThrow — Result → HTTP materialization helper (ADR-6, PPR-S6/S7, ARR-R2/R7 Option B).
 */
import { describe, it, expect } from 'vitest';
import { HttpException } from '@nestjs/common';
import type { Result } from '@educandow/domain';
import { ok, err, DomainError, AxccNotFoundError } from '@educandow/domain';
import { unwrapResultOrThrow } from '../unwrap-result-or-throw';
import { PdfError } from '../../../../application/shared/errors/pdf.error';
import { ApplicationError } from '../../../../application/shared/errors/application-error';
import { InfrastructureError } from '../../../../application/shared/errors/infrastructure-error';

/** Minimal concrete ApplicationError for exercising the helper's ApplicationError branch. */
class TestApplicationError extends ApplicationError {
  constructor() {
    super('scope denied', 'TEST_APP_ERROR', 403);
  }
}

/** Minimal concrete InfrastructureError for exercising the helper's InfrastructureError branch. */
class TestInfrastructureError extends InfrastructureError {
  constructor() {
    super('No tenant client available', 'TENANT_CLIENT_UNAVAILABLE');
  }
}

/** Minimal bare-Error-with-code class, mirrors a bare-Error-with-code shape (e.g. PdfError). */
class TestBareCodeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'TestBareCodeError';
  }
}

describe('unwrapResultOrThrow', () => {
  it('(PPR-S6) err(pdfError) → throws HttpException with status = pdfError.httpStatus (500)', () => {
    const pdfError = new PdfError({ cause: new Error('boom') });

    expect(() => unwrapResultOrThrow(err(pdfError))).toThrow(HttpException);
    try {
      unwrapResultOrThrow(err(pdfError));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(500);
    }
  });

  it('(ATRM-R4) err(applicationError) → re-throws the SAME instance as-is (preserves instanceof + code + httpStatus, not wrapped in HttpException)', () => {
    const appError = new TestApplicationError();

    try {
      unwrapResultOrThrow(err(appError));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBe(appError); // same instance — not re-wrapped
      expect(e).toBeInstanceOf(ApplicationError);
      expect(e).not.toBeInstanceOf(HttpException);
      expect((e as ApplicationError).code).toBe('TEST_APP_ERROR');
      expect((e as ApplicationError).httpStatus).toBe(403);
    }
  });

  it('(PPR-S7) ok(buffer) → returns the same Buffer without throwing', () => {
    const buffer = Buffer.from('PDF-BYTES');

    const result = unwrapResultOrThrow(ok(buffer));

    expect(result).toBe(buffer);
  });

  it('(IEM-R4) err(infrastructureError) → re-throws the SAME instance as-is (preserves instanceof, not wrapped in HttpException)', () => {
    const infraError = new TestInfrastructureError();

    try {
      unwrapResultOrThrow(err(infraError));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBe(infraError); // same instance — not re-wrapped
      expect(e).toBeInstanceOf(InfrastructureError);
      expect(e).not.toBeInstanceOf(HttpException);
    }
  });

  it('(ARR-R2/R7 Option B) err(bare-Error-with-code) → thrown HttpException body carries `code` under a `code` key (not dropped)', () => {
    const bareError = new TestBareCodeError('CourseCycle no encontrado', 'COURSE_CYCLE_NOT_FOUND', 404);

    try {
      unwrapResultOrThrow(err(bareError));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      const httpException = e as HttpException;
      expect(httpException.getStatus()).toBe(404);
      const body = httpException.getResponse() as Record<string, unknown>;
      expect(body.code).toBe('COURSE_CYCLE_NOT_FOUND');
      expect(body.message).toBe('CourseCycle no encontrado');
    }
  });

  it('(RER-R4) err(domainError) → re-throws the SAME instance as-is (preserves instanceof DomainError, not wrapped in HttpException)', () => {
    const domainError = new AxccNotFoundError('Alumno×Curso×Ciclo no encontrado');

    try {
      unwrapResultOrThrow(err(domainError));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBe(domainError); // same instance — not re-wrapped
      expect(e).toBeInstanceOf(DomainError);
      expect(e).not.toBeInstanceOf(HttpException);
      expect((e as DomainError).code).toBe('AXCC_NOT_FOUND');
    }
  });

  it('(RER-R4) tsc compiles for a caller typed Result<T, DomainError | PdfError>', () => {
    function callerReturningUnion(): Result<Buffer, DomainError | PdfError> {
      return err(new AxccNotFoundError('Alumno×Curso×Ciclo no encontrado'));
    }

    expect(() => unwrapResultOrThrow(callerReturningUnion())).toThrow(DomainError);
  });
});
