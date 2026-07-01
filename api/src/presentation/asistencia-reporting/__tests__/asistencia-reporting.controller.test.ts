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
import { ForbiddenException } from '@nestjs/common';
import { ForbiddenError } from '@educandow/domain';
import { AsistenciaReportingController } from '../asistencia-reporting.controller';
import { AsistenciaReportingError } from '../../../application/asistencia-reporting/asistencia-reporting.errors';
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
      executeGeneral: vi.fn().mockResolvedValue(Buffer.from('PDF-GENERAL')),
      executeMateria: vi.fn().mockResolvedValue(Buffer.from('PDF-MATERIA')),
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

    it('maps AsistenciaReportingError to its httpStatus', async () => {
      useCase.executeGeneral.mockRejectedValue(
        new AsistenciaReportingError('CourseCycle no encontrado', 'COURSE_CYCLE_NOT_FOUND', 404),
      );
      const res = makeRes();
      await controller.printGeneral('nope', makeUser() as never, { year: 2026, month: 7 }, res as never);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'COURSE_CYCLE_NOT_FOUND' }));
    });

    it('exposes @Roles module/action metadata consistent with the asistencia list endpoints (ATTENDANCE/READ)', () => {
      const reflector = new Reflector();
      const roles = reflector.get(ROLES_KEY, controller.printGeneral);
      expect(roles).toContainEqual({ module: 'ATTENDANCE', action: 'READ' });
    });

    it('maps a domain ForbiddenError (Door 2 rejection) to NestJS ForbiddenException', async () => {
      useCase.executeGeneral.mockRejectedValue(new ForbiddenError('User is not a preceptor for this CursoXCiclo'));
      const res = makeRes();
      await expect(
        controller.printGeneral('cc-1', makeUser() as never, { year: 2026, month: 7 }, res as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rethrows unknown errors untouched (delegates to the global exception filter)', async () => {
      const boom = new Error('unexpected');
      useCase.executeGeneral.mockRejectedValue(boom);
      const res = makeRes();
      await expect(
        controller.printGeneral('cc-1', makeUser() as never, { year: 2026, month: 7 }, res as never),
      ).rejects.toBe(boom);
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

    it('maps AsistenciaReportingError to its httpStatus', async () => {
      useCase.executeMateria.mockRejectedValue(
        new AsistenciaReportingError('MateriaXCursoXCiclo no encontrada', 'MATERIA_X_CURSO_X_CICLO_NOT_FOUND', 404),
      );
      const res = makeRes();
      await controller.printMateria('nope', makeUser() as never, { year: 2026, month: 7 }, res as never);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('exposes @Roles module/action metadata (ATTENDANCE/READ)', () => {
      const reflector = new Reflector();
      const roles = reflector.get(ROLES_KEY, controller.printMateria);
      expect(roles).toContainEqual({ module: 'ATTENDANCE', action: 'READ' });
    });
  });
});
