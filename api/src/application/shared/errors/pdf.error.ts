/**
 * PdfError — application-level error for PDF generation failures (ADR-1).
 *
 * Carried inside `err(PdfError)` on the Result channel that flows from
 * `PdfPort.generatePdf` through the service, use-cases, and the
 * `unwrapResultOrThrow` helper in `presentation/`, where it is finally
 * materialized as an `HttpException`.
 *
 * Lives in `application/shared/errors/` — NOT `packages/domain` — because
 * rendering a PDF is an application concern, not a domain rule.
 */
export class PdfError extends Error {
  readonly code = 'PDF_GENERATION_FAILED';
  readonly httpStatus = 500;
  readonly cause?: unknown;

  constructor(options?: { cause?: unknown }) {
    super('PDF generation failed');
    this.name = 'PdfError';
    this.cause = options?.cause;
  }
}
