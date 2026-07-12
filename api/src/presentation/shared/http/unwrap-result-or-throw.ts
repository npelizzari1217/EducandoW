/**
 * unwrapResultOrThrow — materializes a Result<T, PdfError> to HTTP (ADR-6).
 *
 * `presentation/` is the only layer allowed to throw (the no-throw rule is
 * scoped to domain/application). This helper is the single point where the
 * PDF Result channel (application) converges with the existing throw-based
 * HttpException pipeline (presentation), reusing `AppExceptionFilter`.
 */
import { HttpException } from '@nestjs/common';
import type { Result } from '@educandow/domain';
import type { PdfError } from '../../../application/shared/errors/pdf.error';

export function unwrapResultOrThrow<T>(result: Result<T, PdfError>): T {
  if (result.isErr()) {
    const error = result.unwrapErr();
    throw new HttpException(
      { statusCode: error.httpStatus, error: error.code, message: error.message },
      error.httpStatus,
    );
  }
  return result.unwrap();
}
