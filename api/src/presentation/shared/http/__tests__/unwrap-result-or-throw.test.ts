/**
 * unwrapResultOrThrow — Result → HTTP materialization helper (ADR-6, PPR-S6/S7).
 */
import { describe, it, expect } from 'vitest';
import { HttpException } from '@nestjs/common';
import { ok, err } from '@educandow/domain';
import { unwrapResultOrThrow } from '../unwrap-result-or-throw';
import { PdfError } from '../../../../application/shared/errors/pdf.error';

describe('unwrapResultOrThrow', () => {
  it('(PPR-S6) err(pdfError) → throws HttpException with status = pdfError.httpStatus (500)', () => {
    const pdfError = new PdfError({ cause: new Error('boom') });

    expect(() => unwrapResultOrThrow(err(pdfError))).toThrow(HttpException);
    try {
      unwrapResultOrThrow(err(pdfError));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(500);
    }
  });

  it('(PPR-S7) ok(buffer) → returns the same Buffer without throwing', () => {
    const buffer = Buffer.from('PDF-BYTES');

    const result = unwrapResultOrThrow(ok(buffer));

    expect(result).toBe(buffer);
  });
});
