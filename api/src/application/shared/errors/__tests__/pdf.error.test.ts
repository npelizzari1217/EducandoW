/**
 * PdfError — shape tests (PPR-S3).
 *
 * `PdfError` is the application-level error carried inside `err(...)` when
 * PDF generation fails (port → service → use-cases). It is a plain `Error`
 * subclass, NOT a `DomainError` (renderizar PDF no es regla de dominio).
 */
import { describe, it, expect } from 'vitest';
import { PdfError } from '../pdf.error';

describe('PdfError', () => {
  it('has code === "PDF_GENERATION_FAILED"', () => {
    const e = new PdfError();
    expect(e.code).toBe('PDF_GENERATION_FAILED');
  });

  it('has httpStatus === 500', () => {
    const e = new PdfError();
    expect(e.httpStatus).toBe(500);
  });

  it('is an instance of Error', () => {
    const e = new PdfError();
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('PdfError');
  });

  it('assigns the optional cause passed in the constructor', () => {
    const original = new Error('Puppeteer timeout');
    const e = new PdfError({ cause: original });
    expect(e.cause).toBe(original);
  });

  it('cause is undefined when not provided', () => {
    const e = new PdfError();
    expect(e.cause).toBeUndefined();
  });
});
