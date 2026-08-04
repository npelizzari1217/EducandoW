/**
 * AsistenciaReportingController — unit tests (PR3c, T3.10).
 *
 * Pattern: plain instantiation (no NestJS test module bootstrap), mocked
 * use-case + mocked Express Response — same lightweight style used across
 * this codebase's controller tests (guards are exercised via metadata
 * inspection, not via full app bootstrap).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { HttpException } from '@nestjs/common';
import { ok, err } from '@educandow/domain';
import { ForbiddenError } from '../../../application/shared/errors/forbidden-error';
import { AsistenciaReportingController } from '../asistencia-reporting.controller';
import { AsistenciaReportingError } from '../../../application/asistencia-reporting/asistencia-reporting.errors';
import { PdfError } from '../../../application/shared/errors/pdf.error';
import { ROLES_KEY } from '../../../infrastructure/auth/decorators/roles.decorator';

function makeRes() {
  return {
    set: vi.fn(),
    send: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
}

function makeUser() {
  return { userId: 'u1', roles: ['ADMIN'] };
}

describe('AsistenciaReportingController', () => {
  let useCase: { executeGeneral: ReturnType<typeof vi.fn>; executeMateria: ReturnType<typeof vi.fn> };
  let controller: AsistenciaReportingController;

  beforeEach(() => {
    useCase = {
      executeGeneral: vi.fn().mockResolvedValue(ok(Buffer.from('PDF-GENERAL'))),
      executeMateria: vi.fn().mockResolvedValue(ok(Buffer.from('PDF-MATERIA'))),
    };
    controller = new AsistenciaReportingController(useCase as never);
  });

  describe('GET .../asistencia-mensual/print (General)', () => {
    it('calls executeGeneral and returns the PDF with attachment headers', async () => {
      const res = makeRes();
      await controller.printGeneral('cc-1', makeUser() as never, { year: 2026, month: 7 }, res as never);

      expect(useCase.executeGeneral).toHaveBeenCalledWith({
        courseCycleId: 'cc-1', year: 2026, month: 7, userId: 'u1', userRoles: ['ADMIN'],
      });
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Content-Disposition': expect.stringContaining('attachment'),
      }));
      expect(res.send).toHaveBeenCalledWith(Buffer.from('PDF-GENERAL'));
    });

    it('maps err(AsistenciaReportingError) to an HttpException with its httpStatus and preserved code', async () => {
      useCase.executeGeneral.mockResolvedValue(
        err(new AsistenciaReportingError('CourseCycle no encontrado', 'COURSE_CYCLE_NOT_FOUND', 404)),
      );
      const res = makeRes();
      const promise = controller.printGeneral('nope', makeUser() as never, { year: 2026, month: 7 }, res as never);

      await expect(promise).rejects.toBeInstanceOf(HttpException);
      await promise.catch((e: HttpException) => {
        expect(e.getStatus()).toBe(404);
        expect((e.getResponse() as Record<string, unknown>).code).toBe('COURSE_CYCLE_NOT_FOUND');
      });
      expect(res.send).not.toHaveBeenCalled();
    });

    it('exposes @Roles module/action metadata consistent with the asistencia list endpoints (ATTENDANCE/READ)', () => {
      const reflector = new Reflector();
      const roles = reflector.get(ROLES_KEY, controller.printGeneral);
      expect(roles).toContainEqual({ module: 'ATTENDANCE', action: 'READ' });
    });

    it('maps a domain err(ForbiddenError) (Door 2 rejection) to the SAME ForbiddenError instance (403 via ApplicationError filter branch)', async () => {
      useCase.executeGeneral.mockResolvedValue(err(new ForbiddenError('User is not a preceptor for this CursoXCiclo')));
      const res = makeRes();
      await expect(
        controller.printGeneral('cc-1', makeUser() as never, { year: 2026, month: 7 }, res as never),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('rethrows unknown errors untouched (a genuine bug bypassing the Result channel; delegates to the global exception filter)', async () => {
      const boom = new Error('unexpected');
      useCase.executeGeneral.mockRejectedValue(boom);
      const res = makeRes();
      await expect(
        controller.printGeneral('cc-1', makeUser() as never, { year: 2026, month: 7 }, res as never),
      ).rejects.toBe(boom);
    });

    it('(PPR-S8) err(PdfError) → the helper throws HttpException(500); handleError rethrows it (not AsistenciaReportingError/ForbiddenError), no PDF ever sent', async () => {
      useCase.executeGeneral.mockResolvedValue(err(new PdfError({ cause: new Error('boom') })));
      const res = makeRes();

      const promise = controller.printGeneral('cc-1', makeUser() as never, { year: 2026, month: 7 }, res as never);

      await expect(promise).rejects.toBeInstanceOf(HttpException);
      await promise.catch((e: HttpException) => {
        expect(e.getStatus()).toBe(500);
      });
      expect(res.send).not.toHaveBeenCalled();
    });
  });

  describe('GET .../asistencia-mensual/print (Por Materia)', () => {
    it('calls executeMateria and returns the PDF with attachment headers', async () => {
      const res = makeRes();
      await controller.printMateria('mxcc-1', makeUser() as never, { year: 2026, month: 7 }, res as never);

      expect(useCase.executeMateria).toHaveBeenCalledWith({
        materiaXCursoXCicloId: 'mxcc-1', year: 2026, month: 7, grupoId: undefined, userId: 'u1', userRoles: ['ADMIN'],
      });
      expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Content-Disposition': expect.stringContaining('attachment'),
      }));
      expect(res.send).toHaveBeenCalledWith(Buffer.from('PDF-MATERIA'));
    });

    it('forwards optional grupoId to the use-case', async () => {
      const res = makeRes();
      await controller.printMateria('mxcc-1', makeUser() as never, { year: 2026, month: 7, grupoId: 'grp-1' }, res as never);
      expect(useCase.executeMateria).toHaveBeenCalledWith(expect.objectContaining({ grupoId: 'grp-1' }));
    });

    it('maps err(AsistenciaReportingError) to an HttpException with its httpStatus and preserved code', async () => {
      useCase.executeMateria.mockResolvedValue(
        err(new AsistenciaReportingError('MateriaXCursoXCiclo no encontrada', 'MATERIA_X_CURSO_X_CICLO_NOT_FOUND', 404)),
      );
      const res = makeRes();
      const promise = controller.printMateria('nope', makeUser() as never, { year: 2026, month: 7 }, res as never);

      await expect(promise).rejects.toBeInstanceOf(HttpException);
      await promise.catch((e: HttpException) => {
        expect(e.getStatus()).toBe(404);
        expect((e.getResponse() as Record<string, unknown>).code).toBe('MATERIA_X_CURSO_X_CICLO_NOT_FOUND');
      });
      expect(res.send).not.toHaveBeenCalled();
    });

    it('exposes @Roles module/action metadata (ATTENDANCE/READ)', () => {
      const reflector = new Reflector();
      const roles = reflector.get(ROLES_KEY, controller.printMateria);
      expect(roles).toContainEqual({ module: 'ATTENDANCE', action: 'READ' });
    });

    it('(PPR-S8) err(PdfError) → the helper throws HttpException(500); handleError rethrows it, no PDF ever sent', async () => {
      useCase.executeMateria.mockResolvedValue(err(new PdfError({ cause: new Error('boom') })));
      const res = makeRes();

      const promise = controller.printMateria('mxcc-1', makeUser() as never, { year: 2026, month: 7 }, res as never);

      await expect(promise).rejects.toBeInstanceOf(HttpException);
      await promise.catch((e: HttpException) => {
        expect(e.getStatus()).toBe(500);
      });
      expect(res.send).not.toHaveBeenCalled();
    });
  });
});
