/**
 * unwrapResultOrThrow — materializes a Result<T, E> to HTTP (ADR-6).
 *
 * `presentation/` is the only layer allowed to throw (the no-throw rule is
 * scoped to domain/application). This helper is the single point where a
 * Result channel (application) converges with the existing throw-based
 * HttpException pipeline (presentation), reusing `AppExceptionFilter`.
 *
 * `ApplicationError` and `InfrastructureError` instances are re-thrown as-is
 * (attendance-type-result-migration, ATRM-R3/R4/R5; infrastructure-error-model,
 * IEM-R4): `AppExceptionFilter`'s dedicated branches already map `code`/`httpStatus`
 * correctly from the original instance. `DomainError` instances (reporting-errors-
 * reclassification, RER-R4) are re-thrown the same way so the filter's `DomainError`
 * branch maps `DOMAIN_STATUS[code]`. Wrapping any of these in a generic `HttpException`
 * (as done below for everything else) would lose both the `instanceof` identity and,
 * for the bare-Error case, the `code` field, since the filter's plain `HttpException`
 * branch does not read a `code` back out of the response body unless it's re-embedded.
 * Non-tiered errors (e.g. `PdfError`, which predates the `ApplicationError` hierarchy
 * and extends `Error` directly) keep the original generic `HttpException`
 * materialization. The generic bound is structural (not tied to `PdfError |
 * ApplicationError`) so it also admits these bare classes, as long as they carry
 * `code`/`message` and an optional `httpStatus` (asistencia-reporting-result,
 * ARR-R2/R7 Option B). `httpStatus` is optional in the bound because `DomainError`
 * does not carry one (its status is resolved by `AppExceptionFilter`'s `DOMAIN_STATUS`
 * map, not by the error instance) — RER-R4. The `code` is placed under a `code` key
 * in the thrown `HttpException`'s response body so `AppExceptionFilter`'s
 * `HttpException` branch can re-read it into the final envelope — preserving the
 * machine-readable code instead of silently dropping it.
 */
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Result } from '@educandow/domain';
import { DomainError } from '@educandow/domain';
import { ApplicationError } from '../../../application/shared/errors/application-error';
import { InfrastructureError } from '../../../application/shared/errors/infrastructure-error';

export function unwrapResultOrThrow<T, E extends { code: string; message: string; httpStatus?: number }>(
  result: Result<T, E>,
): T {
  if (result.isErr()) {
    const error = result.unwrapErr();
    if (error instanceof ApplicationError) {
      throw error;
    }
    if (error instanceof InfrastructureError) {
      throw error; // preserve instanceof identity so AppExceptionFilter reads code/httpStatus (fixed 500)
    }
    if (error instanceof DomainError) {
      throw error; // RER-R4: re-throw as-is so AppExceptionFilter maps DOMAIN_STATUS[code], NOT the untyped fallback
    }
    const status = error.httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR;
    throw new HttpException(
      { statusCode: status, code: error.code, message: error.message },
      status,
    );
  }
  return result.unwrap();
}
