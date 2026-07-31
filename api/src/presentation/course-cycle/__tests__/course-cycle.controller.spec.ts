/**
 * CourseCycleController — delete/listStudents/generate tests (course-cycle-result-migration).
 * CCRM-R4: verifies the controller adopts `if (result.isErr()) throw result.unwrapErr();`
 * and rethrows the unwrapped DomainError (resolved to HTTP by the AppExceptionFilter),
 * without swallowing or re-wrapping it.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  ok,
  err,
  CourseCycleNotFoundError,
  CourseCycleClosedError,
  AcademicCycleClosedError,
  NotFoundError,
} from '@educandow/domain';

let CourseCycleController: any;

beforeAll(async () => {
  const mod = await import('../course-cycle.controller');
  CourseCycleController = mod.CourseCycleController;
});

function makeController(overrides: Record<string, unknown> = {}) {
  const ctrl = Object.create(CourseCycleController.prototype);
  ctrl.createUC = overrides.createUC ?? { execute: vi.fn() };
  ctrl.updateUC = overrides.updateUC ?? { execute: vi.fn() };
  ctrl.deleteUC = overrides.deleteUC ?? { execute: vi.fn() };
  ctrl.toggleUC = overrides.toggleUC ?? { execute: vi.fn() };
  ctrl.getUC = overrides.getUC ?? { execute: vi.fn() };
  ctrl.listUC = overrides.listUC ?? { execute: vi.fn() };
  ctrl.generateUC = overrides.generateUC ?? { execute: vi.fn() };
  ctrl.getGradingPeriodUC = overrides.getGradingPeriodUC ?? { execute: vi.fn() };
  ctrl.setGradingPeriodUC = overrides.setGradingPeriodUC ?? { execute: vi.fn() };
  ctrl.listStudentsUC = overrides.listStudentsUC ?? { execute: vi.fn() };
  ctrl.listTeacherCCsUC = overrides.listTeacherCCsUC ?? { execute: vi.fn() };
  ctrl.listTeacherSubjectsUC = overrides.listTeacherSubjectsUC ?? { execute: vi.fn() };
  ctrl.listAdminSubjectsUC = overrides.listAdminSubjectsUC ?? { execute: vi.fn() };
  ctrl.getGradingPhaseUC = overrides.getGradingPhaseUC ?? { execute: vi.fn() };
  ctrl.setGradingPhaseUC = overrides.setGradingPhaseUC ?? { execute: vi.fn() };
  return ctrl;
}

describe('CourseCycleController — GET :uuid/students', () => {
  it('ok result → returns { data }', async () => {
    const students = [{ studentId: 'stu-1', firstName: 'Juan', lastName: 'Pérez' }];
    const listStudentsUC = { execute: vi.fn().mockResolvedValue(ok(students)) };
    const ctrl = makeController({ listStudentsUC });

    const response = await ctrl.listStudents('cc-1');

    expect(response).toEqual({ data: students });
  });

  it('err result → rethrows CourseCycleNotFoundError (→ 404 via filter)', async () => {
    const listStudentsUC = {
      execute: vi.fn().mockResolvedValue(err(new CourseCycleNotFoundError('cc-nonexistent'))),
    };
    const ctrl = makeController({ listStudentsUC });

    await expect(ctrl.listStudents('cc-nonexistent')).rejects.toBeInstanceOf(CourseCycleNotFoundError);
  });
});

describe('CourseCycleController — DELETE :uuid', () => {
  it('ok result → returns void (204)', async () => {
    const deleteUC = { execute: vi.fn().mockResolvedValue(ok(undefined)) };
    const ctrl = makeController({ deleteUC });

    const response = await ctrl.delete('cc-1');

    expect(response).toBeUndefined();
  });

  it('err result → rethrows CourseCycleClosedError (→ 409 via filter)', async () => {
    const deleteUC = {
      execute: vi.fn().mockResolvedValue(err(new CourseCycleClosedError('cc-1'))),
    };
    const ctrl = makeController({ deleteUC });

    await expect(ctrl.delete('cc-1')).rejects.toBeInstanceOf(CourseCycleClosedError);
  });

  it('err result → rethrows CourseCycleNotFoundError (→ 404 via filter)', async () => {
    const deleteUC = {
      execute: vi.fn().mockResolvedValue(err(new CourseCycleNotFoundError('cc-nonexistent'))),
    };
    const ctrl = makeController({ deleteUC });

    await expect(ctrl.delete('cc-nonexistent')).rejects.toBeInstanceOf(CourseCycleNotFoundError);
  });
});

describe('CourseCycleController — POST generate', () => {
  it('ok result → returns { data }', async () => {
    const created = { created: 5, updated: 0, total: 5 };
    const generateUC = { execute: vi.fn().mockResolvedValue(ok(created)) };
    const ctrl = makeController({ generateUC });

    const response = await ctrl.generate({ level: 20, cycleId: 'cycle-1' });

    expect(response).toEqual({ data: created });
  });

  it('err result → rethrows NotFoundError (→ 404 via filter)', async () => {
    const generateUC = {
      execute: vi.fn().mockResolvedValue(err(new NotFoundError('AcademicCycle', 'nonexistent-cycle'))),
    };
    const ctrl = makeController({ generateUC });

    await expect(
      ctrl.generate({ level: 20, cycleId: 'nonexistent-cycle' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('err result → rethrows AcademicCycleClosedError (→ 409 via filter)', async () => {
    const generateUC = {
      execute: vi.fn().mockResolvedValue(err(new AcademicCycleClosedError('cycle-1'))),
    };
    const ctrl = makeController({ generateUC });

    await expect(
      ctrl.generate({ level: 20, cycleId: 'cycle-1' }),
    ).rejects.toBeInstanceOf(AcademicCycleClosedError);
  });
});
