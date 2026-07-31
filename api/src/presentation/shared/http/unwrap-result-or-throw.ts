/**
 * unwrapResultOrThrow — materializes a Result<T, E> to HTTP (ADR-6).
 *
 * `presentation/` is the only layer allowed to throw (the no-throw rule is
 * scoped to domain/application). This helper is the single point where a
 * Result channel (application) converges with the existing throw-based
 * HttpException pipeline (presentation), reusing `AppExceptionFilter`.
 *
 * Generic over any error shape carrying `code`/`httpStatus`/`message`
 * (attendance-type-result-migration, ATRM-R3/R5): `GenerateAttendanceTypesPdfUseCase`
 * now returns `Result<Buffer, PdfError | AttendanceTypeLevelOutOfScopeError>`, so this
 * helper can no longer be pinned to `PdfError` alone — it was never PDF-specific in
 * behavior, only in its original (too-narrow) type signature.
 */
import { HttpException } from '@nestjs/common';
import type { Result } from '@educandow/domain';

interface HttpMappableError {
  readonly code: string;
  readonly httpStatus: number;
  readonly message: string;
}

export function unwrapResultOrThrow<T, E extends HttpMappableError>(result: Result<T, E>): T {
  if (result.isErr()) {
    const error = result.unwrapErr();
    throw new HttpException(
      { statusCode: error.httpStatus, error: error.code, message: error.message },
      error.httpStatus,
    );
  }
  return result.unwrap();
}
