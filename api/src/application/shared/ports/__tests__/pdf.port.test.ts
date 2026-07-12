/**
 * pdf-port (ADR-06, PPR-R1) — PDP-S1 / PPR-S1.
 *
 * Verifies that `pdf.port.ts` exports the contract surface required by the
 * spec: the `PdfPort` interface
 * (`generatePdf(html, options?): Promise<Result<Buffer, PdfError>>`),
 * the `PDF_PORT` symbol token, and the `GeneratePdfOptions` type.
 */
import { describe, it, expect } from 'vitest';
import { ok } from '@educandow/domain';
import type { PdfPort, GeneratePdfOptions } from '../pdf.port';
import { PDF_PORT } from '../pdf.port';

describe('pdf.port', () => {
  it('exports PDF_PORT as a symbol', () => {
    expect(typeof PDF_PORT).toBe('symbol');
  });

  it('PdfPort.generatePdf accepts (html: string, options?: GeneratePdfOptions) and returns Promise<Result<Buffer, PdfError>>', async () => {
    const stub: PdfPort = {
      generatePdf: async (html: string, options?: GeneratePdfOptions) => {
        expect(typeof html).toBe('string');
        void options;
        return ok(Buffer.from('PDF'));
      },
    };

    expect(typeof stub.generatePdf).toBe('function');
    const result = await stub.generatePdf('<html></html>');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual(Buffer.from('PDF'));
  });

  it('GeneratePdfOptions accepts landscape and margin as optional fields', () => {
    const options: GeneratePdfOptions = {
      landscape: true,
      margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
    };

    expect(options.landscape).toBe(true);
  });
});
