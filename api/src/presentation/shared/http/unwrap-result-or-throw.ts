/**
 * unwrapResultOrThrow — materializes a Result<T, E> to HTTP (ADR-6).
 *
 * `presentation/` is the only layer allowed to throw (the no-throw rule is
 * scoped to domain/application). This helper is the single point where a
 * Result channel (application) converges with the existing throw-based
 * HttpException pipeline (presentation), reusing `AppExceptionFilter`.
 *
 * `ApplicationError` instances are re-thrown as-is (attendance-type-result-migration,
 * ATRM-R3/R4/R5): `AppExceptionFilter`'s `ApplicationError` branch already maps
 * `code`/`httpStatus` correctly from the original instance. Wrapping them in a
 * generic `HttpException` (as done below for everything else) would lose both
 * the `instanceof` identity and the `code` field, since the filter's plain
 * `HttpException` branch does not read a `code` back out of the response body.
 * Non-`ApplicationError` errors (e.g. `PdfError`, which predates the
 * `ApplicationError` hierarchy and extends `Error` directly) keep the original
 * generic `HttpException` materialization, unchanged.
 */
import { HttpException } from '@nestjs/common';
import type { Result } from '@educandow/domain';
import { ApplicationError } from '../../../application/shared/errors/application-error';
import type { PdfError } from '../../../application/shared/errors/pdf.error';

export function unwrapResultOrThrow<T, E extends PdfError | ApplicationError>(result: Result<T, E>): T {
  if (result.isErr()) {
    const error = result.unwrapErr();
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw new HttpException(
      { statusCode: error.httpStatus, error: error.code, message: error.message },
      error.httpStatus,
    );
  }
  return result.unwrap();
}
