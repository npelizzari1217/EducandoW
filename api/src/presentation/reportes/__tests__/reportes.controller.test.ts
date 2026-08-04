/**
 * ReportesController — unit tests (PPR-S8/S9).
 *
 * Pattern: plain instantiation (no NestJS test module bootstrap), mocked
 * use-cases + mocked Express Response — same lightweight style used across
 * this codebase's controller tests (see asistencia-reporting.controller.test.ts).
 *
 * Scope: only the 2 endpoints that changed to unwrapResultOrThrow
 * (getBoletin, createConstanciaRegular). getBoletinBatch is unchanged
 * (still consumes a raw Buffer from the ZIP use-case) — not covered here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException } from '@nestjs/common';
import { ok, err } from '@educandow/domain';
import { ReportesController } from '../reportes.controller';
import { BoletinError } from '../../../application/reportes/generate-boletin.use-case';
import { ConstanciaError } from '../../../application/reportes/templates/constancia.template';
import { PdfError } from '../../../application/shared/errors/pdf.error';

function makeRes() {
  return {
    set: vi.fn(),
    send: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
}

describe('ReportesController', () => {
  let singleUC: { execute: ReturnType<typeof vi.fn> };
  let batchUC: { execute: ReturnType<typeof vi.fn> };
  let constanciaUC: { execute: ReturnType<typeof vi.fn> };
  let controller: ReportesController;

  beforeEach(() => {
    singleUC = { execute: vi.fn().mockResolvedValue(ok(Buffer.from('BOLETIN-PDF'))) };
    batchUC = { execute: vi.fn() };
    constanciaUC = { execute: vi.fn().mockResolvedValue(ok(Buffer.from('CONSTANCIA-PDF'))) };
    controller = new ReportesController(singleUC as never, batchUC as never, constanciaUC as never);
  });

  describe('GET boletin/:alumnosXCursoXCicloId', () => {
    it('(PPR-S9) ok(buffer) → responds 200 with the PDF, no throw in application', async () => {
      const res = makeRes();

      await controller.getBoletin('axcc-1', res as never);

      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'Content-Type': 'application/pdf',
      }));
      expect(res.send).toHaveBeenCalledWith(Buffer.from('BOLETIN-PDF'));
      expect(res.status).not.toHaveBeenCalled();
    });

    it('(PPR-S8) err(PdfError) → the helper throws HttpException(500); not a BoletinError so it is re-thrown to the global filter (no PDF ever sent, no throw inside application)', async () => {
      singleUC.execute.mockResolvedValue(err(new PdfError({ cause: new Error('boom') })));
      const res = makeRes();

      const promise = controller.getBoletin('axcc-1', res as never);

      await expect(promise).rejects.toBeInstanceOf(HttpException);
      await promise.catch((e: HttpException) => {
        expect(e.getStatus()).toBe(500);
      });
      expect(res.send).not.toHaveBeenCalled();
    });

    it('maps err(BoletinError) to an HttpException with its httpStatus and preserved code', async () => {
      singleUC.execute.mockResolvedValue(err(new BoletinError('no encontrado', 'AXCC_NOT_FOUND', 404)));
      const res = makeRes();

      const promise = controller.getBoletin('axcc-missing', res as never);

      await expect(promise).rejects.toBeInstanceOf(HttpException);
      await promise.catch((e: HttpException) => {
        expect(e.getStatus()).toBe(404);
        expect((e.getResponse() as Record<string, unknown>).code).toBe('AXCC_NOT_FOUND');
      });
      expect(res.send).not.toHaveBeenCalled();
    });
  });

  describe('POST constancia-regular/:axccId', () => {
    const body = { destinatario: 'Test', fechaEmision: '2026-06-26' };

    it('(PPR-S9) ok(buffer) → responds 200 with the PDF, no throw in application', async () => {
      const res = makeRes();

      await controller.createConstanciaRegular('axcc-1', body, res as never);

      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'Content-Type': 'application/pdf',
      }));
      expect(res.send).toHaveBeenCalledWith(Buffer.from('CONSTANCIA-PDF'));
      expect(res.status).not.toHaveBeenCalled();
    });

    it('(PPR-S8) err(PdfError) → the helper throws HttpException(500); not a ConstanciaError so it is re-thrown to the global filter (no PDF ever sent, no throw inside application)', async () => {
      constanciaUC.execute.mockResolvedValue(err(new PdfError({ cause: new Error('boom') })));
      const res = makeRes();

      const promise = controller.createConstanciaRegular('axcc-1', body, res as never);

      await expect(promise).rejects.toBeInstanceOf(HttpException);
      await promise.catch((e: HttpException) => {
        expect(e.getStatus()).toBe(500);
      });
      expect(res.send).not.toHaveBeenCalled();
    });

    it('still maps a thrown ConstanciaError to its httpStatus (canal B, unchanged)', async () => {
      constanciaUC.execute.mockRejectedValue(new ConstanciaError('no elegible', 'STUDENT_NOT_ELIGIBLE', 422));
      const res = makeRes();

      await controller.createConstanciaRegular('axcc-1', body, res as never);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'STUDENT_NOT_ELIGIBLE' }));
    });
  });
});
