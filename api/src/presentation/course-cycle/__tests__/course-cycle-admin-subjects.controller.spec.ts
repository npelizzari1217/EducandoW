/**
 * CourseCycleController — GET :uuid/subjects admin path tests.
 * Verifica que roles administrativos usen listAdminSubjectsUC
 * y que docentes sigan usando listTeacherSubjectsUC.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

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
  ctrl.listUC = overrides.listUC ?? { execute: vi.fn().mockResolvedValue({ data: [], page: 1, pageSize: 10, total: 0 }) };
  ctrl.generateUC = overrides.generateUC ?? { execute: vi.fn() };
  ctrl.getGradingPeriodUC = overrides.getGradingPeriodUC ?? { execute: vi.fn() };
  ctrl.setGradingPeriodUC = overrides.setGradingPeriodUC ?? { execute: vi.fn() };
  ctrl.listStudentsUC = overrides.listStudentsUC ?? { execute: vi.fn() };
  ctrl.listTeacherCCsUC = overrides.listTeacherCCsUC ?? { execute: vi.fn().mockResolvedValue([]) };
  ctrl.listTeacherSubjectsUC = overrides.listTeacherSubjectsUC ?? {
    execute: vi.fn().mockResolvedValue([]),
  };
  ctrl.listAdminSubjectsUC = overrides.listAdminSubjectsUC ?? {
    execute: vi.fn().mockResolvedValue([{ subjectId: 'subj-1', subjectName: 'Matemática', studyPlanSubjectId: null }]),
  };
  return ctrl;
}

describe('CourseCycleController — GET :uuid/subjects — admin path (Puerta 1)', () => {
  it('ROOT sin teacherUserId → usa listAdminSubjectsUC (ve todas las materias)', async () => {
    const adminMock = vi.fn().mockResolvedValue([{ subjectId: 's-1', subjectName: 'Matemática', studyPlanSubjectId: null }]);
    const teacherMock = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({
      listAdminSubjectsUC: { execute: adminMock },
      listTeacherSubjectsUC: { execute: teacherMock },
    });
    const rootUser = { userId: 'root-id', roles: ['ROOT'] };

    const result = await ctrl.listSubjects('cc-uuid-1', rootUser, {});

    expect(adminMock).toHaveBeenCalledWith('cc-uuid-1');
    expect(teacherMock).not.toHaveBeenCalled();
    expect(result).toEqual({ data: [{ subjectId: 's-1', subjectName: 'Matemática', studyPlanSubjectId: null }] });
  });

  it('ADMIN → usa listAdminSubjectsUC', async () => {
    const adminMock = vi.fn().mockResolvedValue([]);
    const teacherMock = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({
      listAdminSubjectsUC: { execute: adminMock },
      listTeacherSubjectsUC: { execute: teacherMock },
    });
    const adminUser = { userId: 'admin-id', roles: ['ADMIN'] };

    await ctrl.listSubjects('cc-uuid-1', adminUser, {});

    expect(adminMock).toHaveBeenCalledWith('cc-uuid-1');
    expect(teacherMock).not.toHaveBeenCalled();
  });

  it('DIRECTOR → usa listAdminSubjectsUC', async () => {
    const adminMock = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({ listAdminSubjectsUC: { execute: adminMock } });
    const directorUser = { userId: 'dir-id', roles: ['DIRECTOR'], levels: [20] };

    await ctrl.listSubjects('cc-uuid-1', directorUser, {});

    expect(adminMock).toHaveBeenCalledWith('cc-uuid-1');
  });

  it('SECRETARIO → usa listAdminSubjectsUC', async () => {
    const adminMock = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({ listAdminSubjectsUC: { execute: adminMock } });
    const secretarioUser = { userId: 'sec-id', roles: ['SECRETARIO'], levels: [20] };

    await ctrl.listSubjects('cc-uuid-1', secretarioUser, {});

    expect(adminMock).toHaveBeenCalledWith('cc-uuid-1');
  });

  it('TEACHER → usa listTeacherSubjectsUC con JWT userId', async () => {
    const adminMock = vi.fn().mockResolvedValue([]);
    const teacherMock = vi.fn().mockResolvedValue([{ subjectId: 's-1', subjectName: 'Arte', studyPlanSubjectId: null }]);
    const ctrl = makeController({
      listAdminSubjectsUC: { execute: adminMock },
      listTeacherSubjectsUC: { execute: teacherMock },
    });
    const teacherUser = { userId: 'teacher-uuid', roles: ['TEACHER'] };

    const result = await ctrl.listSubjects('cc-uuid-1', teacherUser, {});

    expect(teacherMock).toHaveBeenCalledWith({ userId: 'teacher-uuid', courseCycleId: 'cc-uuid-1' });
    expect(adminMock).not.toHaveBeenCalled();
    expect(result).toHaveProperty('data');
  });

  it('ROOT con teacherUserId → usa listTeacherSubjectsUC con teacherUserId (override admin)', async () => {
    const adminMock = vi.fn().mockResolvedValue([]);
    const teacherMock = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({
      listAdminSubjectsUC: { execute: adminMock },
      listTeacherSubjectsUC: { execute: teacherMock },
    });
    const rootUser = { userId: 'root-id', roles: ['ROOT'] };

    await ctrl.listSubjects('cc-uuid-1', rootUser, { teacherUserId: 'specific-teacher' });

    expect(teacherMock).toHaveBeenCalledWith({ userId: 'specific-teacher', courseCycleId: 'cc-uuid-1' });
    expect(adminMock).not.toHaveBeenCalled();
  });
});
