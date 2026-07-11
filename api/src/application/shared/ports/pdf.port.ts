/**
 * PdfPort — application-level contract for HTML→PDF rendering (ADR-06).
 *
 * `application/` depends on this port, never on the concrete infrastructure
 * engine. `infrastructure/reporting/pdf-generator.service.ts` implements it.
 * Pure application artifact — no `@Injectable`, no NestJS/Puppeteer import.
 */

/** Optional per-call overrides for {@link PdfPort.generatePdf}. */
export interface GeneratePdfOptions {
  /** Renders the page in landscape orientation. Default: `false` (portrait). */
  landscape?: boolean;
  /** Overrides individual margin sides; unspecified sides keep the default (15mm/12mm). */
  margin?: Partial<{ top: string; bottom: string; left: string; right: string }>;
}

export interface PdfPort {
  /** Renders the given HTML string to a PDF Buffer. */
  generatePdf(html: string, options?: GeneratePdfOptions): Promise<Buffer>;
}

/** DI token for {@link PdfPort} — resolves to the `ReportingModule` singleton (PDP-R5). */
export const PDF_PORT = Symbol('PDF_PORT');
