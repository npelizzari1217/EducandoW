/**
 * PdfPort — application-level contract for HTML→PDF rendering (ADR-06, PPR-R1).
 *
 * `application/` depends on this port, never on the concrete infrastructure
 * engine. `infrastructure/reporting/pdf-generator.service.ts` implements it.
 * Pure application artifact — no `@Injectable`, no NestJS/Puppeteer import.
 *
 * `generatePdf` MUST NOT throw nor reject on a rendering failure — it
 * represents that failure as `err(PdfError)` (PPR-R1/S1), so the error flows
 * as a Result all the way through `application/` up to `presentation/`.
 */
import type { Result } from '@educandow/domain';
import type { PdfError } from '../errors/pdf.error';

/** Optional per-call overrides for {@link PdfPort.generatePdf}. */
export interface GeneratePdfOptions {
  /** Renders the page in landscape orientation. Default: `false` (portrait). */
  landscape?: boolean;
  /** Overrides individual margin sides; unspecified sides keep the default (15mm/12mm). */
  margin?: Partial<{ top: string; bottom: string; left: string; right: string }>;
}

export interface PdfPort {
  /** Renders the given HTML string to a PDF Buffer, or `err(PdfError)` on failure. */
  generatePdf(html: string, options?: GeneratePdfOptions): Promise<Result<Buffer, PdfError>>;
}

/** DI token for {@link PdfPort} — resolves to the `ReportingModule` singleton (PDP-R5). */
export const PDF_PORT = Symbol('PDF_PORT');
