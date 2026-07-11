/**
 * pdf-port (ADR-06) — PDP-S1.
 *
 * Verifies that `pdf.port.ts` exports the contract surface required by the
 * spec: the `PdfPort` interface (`generatePdf(html, options?): Promise<Buffer>`),
 * the `PDF_PORT` symbol token, and the `GeneratePdfOptions` type.
 */
import { describe, it, expect } from 'vitest';
import type { PdfPort, GeneratePdfOptions } from '../pdf.port';
import { PDF_PORT } from '../pdf.port';

describe('pdf.port', () => {
  it('exports PDF_PORT as a symbol', () => {
    expect(typeof PDF_PORT).toBe('symbol');
  });

  it('PdfPort.generatePdf accepts (html: string, options?: GeneratePdfOptions) and returns Promise<Buffer>', () => {
    const stub: PdfPort = {
      generatePdf: async (html: string, options?: GeneratePdfOptions) => {
        expect(typeof html).toBe('string');
        void options;
        return Buffer.from('PDF');
      },
    };

    expect(typeof stub.generatePdf).toBe('function');
  });

  it('GeneratePdfOptions accepts landscape and margin as optional fields', () => {
    const options: GeneratePdfOptions = {
      landscape: true,
      margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
    };

    expect(options.landscape).toBe(true);
  });
});
