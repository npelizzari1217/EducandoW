/**
 * ReportesController — unit tests (PPR-S8/S9).
 *
 * Pattern: plain instantiation (no NestJS test module bootstrap), mocked
 * use-cases + mocked Express Response — same lightweight style used across
 * this codebase's controller tests (see asistencia-reporting.controller.test.ts).
 *
 * Scope: getBoletin, getBoletinBatch (net-new, ARR-R6/C.7), and
 * createConstanciaRegular.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException } from '@nestjs/common';
import {
  ok,
  err,
  AxccNotFoundError,
  BatchAllFailedError,
  StudentNotEligibleError,
} from '@educandow/domain';
import { ReportesController } from '../reportes.controller';
import { PdfError } from '../../../application/shared/errors/pdf.error';
import { TenantClientUnavailableError } from '../../../application/shared/errors/infrastructure-errors';

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

    it('(PPR-S8) err(PdfError) → the helper throws HttpException(500); not a DomainError/InfrastructureError so it is re-thrown to the global filter (no PDF ever sent, no throw inside application)', async () => {
      singleUC.execute.mockResolvedValue(err(new PdfError({ cause: new Error('boom') })));
      const res = makeRes();

      const promise = controller.getBoletin('axcc-1', res as never);

      await expect(promise).rejects.toBeInstanceOf(HttpException);
      await promise.catch((e: HttpException) => {
        expect(e.getStatus()).toBe(500);
      });
      expect(res.send).not.toHaveBeenCalled();
    });

    it('maps err(AxccNotFoundError) to the SAME DomainError instance, re-thrown identity-preserving (not wrapped in HttpException)', async () => {
      singleUC.execute.mockResolvedValue(err(new AxccNotFoundError('no encontrado')));
      const res = makeRes();

      const promise = controller.getBoletin('axcc-missing', res as never);

      await expect(promise).rejects.toBeInstanceOf(AxccNotFoundError);
      await promise.catch((e: AxccNotFoundError) => {
        expect(e.code).toBe('AXCC_NOT_FOUND');
      });
      expect(res.send).not.toHaveBeenCalled();
    });
  });

  describe('GET boletin/curso/:courseCycleId (NET-NEW — ARR-R6/C.7)', () => {
    it('ok(buffer) → responds 200 with the ZIP, no throw in application', async () => {
      batchUC.execute.mockResolvedValue(ok(Buffer.from('ZIP-CONTENT')));
      const res = makeRes();

      await controller.getBoletinBatch('cc-1', res as never);

      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'Content-Type': 'application/zip',
      }));
      expect(res.send).toHaveBeenCalledWith(Buffer.from('ZIP-CONTENT'));
      expect(res.status).not.toHaveBeenCalled();
    });

    it('ok(emptyBuffer) → still responds 200 with the empty ZIP (zero printable rows)', async () => {
      batchUC.execute.mockResolvedValue(ok(Buffer.alloc(0)));
      const res = makeRes();

      await controller.getBoletinBatch('cc-1', res as never);

      expect(res.send).toHaveBeenCalledWith(Buffer.alloc(0));
      expect(res.status).not.toHaveBeenCalled();
    });

    it('err(BatchAllFailedError) → the SAME DomainError instance, re-thrown identity-preserving, code BATCH_ALL_FAILED', async () => {
      batchUC.execute.mockResolvedValue(err(new BatchAllFailedError(
        'No se pudo generar ningún boletín del lote — todos fallaron',
      )));
      const res = makeRes();

      const promise = controller.getBoletinBatch('cc-1', res as never);

      await expect(promise).rejects.toBeInstanceOf(BatchAllFailedError);
      await promise.catch((e: BatchAllFailedError) => {
        expect(e.code).toBe('BATCH_ALL_FAILED');
      });
      expect(res.send).not.toHaveBeenCalled();
    });

    it('(RER-R3) err(TenantClientUnavailableError) (no tenant context) → the SAME InfrastructureError instance, code TENANT_CLIENT_UNAVAILABLE at 500, no res.send', async () => {
      batchUC.execute.mockResolvedValue(err(new TenantClientUnavailableError()));
      const res = makeRes();

      const promise = controller.getBoletinBatch('cc-1', res as never);

      await expect(promise).rejects.toBeInstanceOf(TenantClientUnavailableError);
      await promise.catch((e: TenantClientUnavailableError) => {
        expect(e.code).toBe('TENANT_CLIENT_UNAVAILABLE');
        expect(e.httpStatus).toBe(500);
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

    it('(PPR-S8) err(PdfError) → the helper throws HttpException(500); not a DomainError/InfrastructureError so it is re-thrown to the global filter (no PDF ever sent, no throw inside application)', async () => {
      constanciaUC.execute.mockResolvedValue(err(new PdfError({ cause: new Error('boom') })));
      const res = makeRes();

      const promise = controller.createConstanciaRegular('axcc-1', body, res as never);

      await expect(promise).rejects.toBeInstanceOf(HttpException);
      await promise.catch((e: HttpException) => {
        expect(e.getStatus()).toBe(500);
      });
      expect(res.send).not.toHaveBeenCalled();
    });

    it('maps err(StudentNotEligibleError) to the SAME DomainError instance, re-thrown identity-preserving, code STUDENT_NOT_ELIGIBLE', async () => {
      constanciaUC.execute.mockResolvedValue(err(new StudentNotEligibleError('no elegible')));
      const res = makeRes();

      const promise = controller.createConstanciaRegular('axcc-1', body, res as never);

      await expect(promise).rejects.toBeInstanceOf(StudentNotEligibleError);
      await promise.catch((e: StudentNotEligibleError) => {
        expect(e.code).toBe('STUDENT_NOT_ELIGIBLE');
      });
      expect(res.send).not.toHaveBeenCalled();
    });

    it('(RER-R3) err(TenantClientUnavailableError) (no tenant context) → the SAME InfrastructureError instance, code TENANT_CLIENT_UNAVAILABLE at 500, no res.send', async () => {
      constanciaUC.execute.mockResolvedValue(err(new TenantClientUnavailableError()));
      const res = makeRes();

      const promise = controller.createConstanciaRegular('axcc-1', body, res as never);

      await expect(promise).rejects.toBeInstanceOf(TenantClientUnavailableError);
      await promise.catch((e: TenantClientUnavailableError) => {
        expect(e.code).toBe('TENANT_CLIENT_UNAVAILABLE');
        expect(e.httpStatus).toBe(500);
      });
      expect(res.send).not.toHaveBeenCalled();
    });
  });
});
