/**
 * PR4-T18 [RED] — CourseCycleController teacher-filter extension tests.
 * Tests: optional teacherUserId filter on GET /course-cycles,
 *        GET /course-cycles/:id/subjects?teacherUserId=
 * Specs: TIA-R3, TIA-R4, TIA-R5, TIA-R7
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

let CourseCycleController: any;

beforeAll(async () => {
  const mod = await import('../course-cycle.controller');
  CourseCycleController = mod.CourseCycleController;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCC(uuid: string) {
  return {
    uuid,
    courseId: `course-${uuid}`,
    studyPlanId: 'sp-1',
    cycleId: 'cycle-1',
    courseName: { get: () => `Aula ${uuid}` },
    level: { get: () => 20 },
    active: true,
    passingGrade: { get: () => 7 },
    promotionText: null,
    firstBimonth: null,
    secondBimonth: null,
    thirdBimonth: null,
    fourthBimonth: null,
    activeGradingPeriod: null,
    lastModifiedAt: new Date('2024-01-01'),
  };
}

function makeListResult(items: ReturnType<typeof makeCC>[]) {
  return { data: items, page: 1, pageSize: 10, total: items.length, studentCounts: new Map<string, number>() };
}

function makeTeacherCC(uuid: string, modality: number | null = 0) {
  // W3: ListTeacherCourseCyclesUseCase now returns { cycle: CourseCycle, modality }[]
  return { cycle: makeCC(uuid), modality };
}

function makeController(overrides: Record<string, unknown> = {}) {
  const ctrl = Object.create(CourseCycleController.prototype);
  ctrl.createUC = overrides.createUC ?? { execute: vi.fn() };
  ctrl.updateUC = overrides.updateUC ?? { execute: vi.fn() };
  ctrl.deleteUC = overrides.deleteUC ?? { execute: vi.fn() };
  ctrl.toggleUC = overrides.toggleUC ?? { execute: vi.fn() };
  ctrl.getUC = overrides.getUC ?? { execute: vi.fn() };
  ctrl.listUC = overrides.listUC ?? {
    execute: vi.fn().mockResolvedValue(makeListResult([makeCC('cc-1')])),
  };
  ctrl.generateUC = overrides.generateUC ?? { execute: vi.fn() };
  ctrl.getGradingPeriodUC = overrides.getGradingPeriodUC ?? { execute: vi.fn() };
  ctrl.setGradingPeriodUC = overrides.setGradingPeriodUC ?? { execute: vi.fn() };
  ctrl.listStudentsUC = overrides.listStudentsUC ?? { execute: vi.fn() };
  // New UC injected in PR4-T19
  ctrl.listTeacherCCsUC = overrides.listTeacherCCsUC ?? {
    execute: vi.fn().mockResolvedValue([makeTeacherCC('cc-teacher-1')]),
  };
  ctrl.listTeacherSubjectsUC = overrides.listTeacherSubjectsUC ?? {
    execute: vi.fn().mockResolvedValue([{ subjectId: 'subj-1', subjectName: 'Matemática' }]),
  };
  return ctrl;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /course-cycles — optional teacher filter
// ═══════════════════════════════════════════════════════════════════════════════

describe('CourseCycleController — GET list with teacher filter', () => {
  it('TIA-R3: ROOT without teacherUserId calls existing listUC', async () => {
    const listUCMock = vi.fn().mockResolvedValue(makeListResult([makeCC('cc-1')]));
    const ctrl = makeController({ listUC: { execute: listUCMock } });
    const rootUser = { userId: 'root-id', roles: ['ROOT'] };

    const result = await ctrl.list(rootUser, { role: 'subject' });

    expect(listUCMock).toHaveBeenCalled();
    expect(result).toHaveProperty('data');
  });

  it('TIA-R3: ROOT with teacherUserId delegates to listTeacherCCsUC', async () => {
    const listUCMock = vi.fn().mockResolvedValue(makeListResult([]));
    const teacherMock = vi.fn().mockResolvedValue([makeTeacherCC('cc-teacher-1')]);
    const ctrl = makeController({
      listUC: { execute: listUCMock },
      listTeacherCCsUC: { execute: teacherMock },
    });
    const rootUser = { userId: 'root-id', roles: ['ROOT'] };

    const result = await ctrl.list(rootUser, { teacherUserId: 'user-uuid-123', role: 'subject' });

    expect(teacherMock).toHaveBeenCalledWith({ userId: 'user-uuid-123', mode: 'subject' });
    expect(listUCMock).not.toHaveBeenCalled();
    expect(result).toHaveProperty('data');
  });

  it('TIA-R5: role=homeroom passes mode=homeroom to listTeacherCCsUC', async () => {
    const teacherMock = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({ listTeacherCCsUC: { execute: teacherMock } });
    const teacherUser = { userId: 'user-uuid-123', roles: ['TEACHER'] };

    await ctrl.list(teacherUser, { role: 'homeroom' });

    expect(teacherMock).toHaveBeenCalledWith({ userId: 'user-uuid-123', mode: 'homeroom' });
  });

  it('TIA-R2: unlinked teacher → empty array 200 (not error)', async () => {
    const teacherMock = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({ listTeacherCCsUC: { execute: teacherMock } });
    const teacherUser = { userId: 'unknown-user', roles: ['TEACHER'] };

    const result = await ctrl.list(teacherUser, { role: 'subject' });

    expect(result.data).toEqual([]);
    // listTeacherCCsUC called with JWT userId (unlinked → empty is fine)
    expect(teacherMock).toHaveBeenCalledWith({ userId: 'unknown-user', mode: 'subject' });
  });

  it('response wraps teacher CCs in { data }', async () => {
    const cc = makeTeacherCC('cc-1');
    const teacherMock = vi.fn().mockResolvedValue([cc]);
    const ctrl = makeController({ listTeacherCCsUC: { execute: teacherMock } });
    const teacherUser = { userId: 'user-1', roles: ['TEACHER'] };

    const result = await ctrl.list(teacherUser, { role: 'subject' });

    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data[0].uuid).toBe('cc-1');
  });

  it('W3-RED: teacher-filtered response includes real modality (not null) when use case resolves it', async () => {
    const cc = makeCC('cc-1');
    // After W3 fix: listTeacherCCsUC returns { cycle, modality }[] and controller passes modality to toResponse
    const teacherMock = vi.fn().mockResolvedValue([{ cycle: cc, modality: 5 }]);
    const ctrl = makeController({ listTeacherCCsUC: { execute: teacherMock } });
    const teacherUser = { userId: 'user-1', roles: ['TEACHER'] };

    const result = await ctrl.list(teacherUser, { role: 'subject' });

    expect(result.data[0].modality).toBe(5);
  });

  // ── AUTHZ-C2: non-ROOT uses JWT userId ──────────────────────────────────────
  it('AUTHZ-C2: non-ROOT caller uses JWT userId, ignores query teacherUserId', async () => {
    const teacherMock = vi.fn().mockResolvedValue([makeTeacherCC('cc-jwt-1')]);
    const ctrl = makeController({ listTeacherCCsUC: { execute: teacherMock } });
    const teacherUser = { userId: 'jwt-user-id', roles: ['TEACHER'] };

    await ctrl.list(teacherUser, { teacherUserId: 'other-teacher-id', role: 'subject' });

    // MUST use jwtUser.userId, NOT 'other-teacher-id'
    expect(teacherMock).toHaveBeenCalledWith({ userId: 'jwt-user-id', mode: 'subject' });
    const callArgs = teacherMock.mock.calls.flat();
    expect(JSON.stringify(callArgs)).not.toContain('other-teacher-id');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Puerta 2 — access scope (resolveAccessScope) integration in list()
// ═══════════════════════════════════════════════════════════════════════════════

describe('CourseCycleController — list() access scope (Puerta 2)', () => {
  it('SECRETARIO with levelIn=[20] passes levelIn to listUC', async () => {
    const listUCMock = vi.fn().mockResolvedValue(makeListResult([makeCC('cc-sec-1')]));
    const ctrl = makeController({ listUC: { execute: listUCMock } });
    const secretarioUser = { userId: 'sec-id', roles: ['SECRETARIO'], levels: [20] };

    await ctrl.list(secretarioUser, {});

    expect(listUCMock).toHaveBeenCalledWith(
      expect.objectContaining({ levelIn: [20] }),
    );
    // level (UI filter) not set, so should not appear
    const call = listUCMock.mock.calls[0][0];
    expect(call.level).toBeUndefined();
  });

  it('DIRECTOR with levelIn=[30,40] passes levelIn to listUC', async () => {
    const listUCMock = vi.fn().mockResolvedValue(makeListResult([]));
    const ctrl = makeController({ listUC: { execute: listUCMock } });
    const directorUser = { userId: 'dir-id', roles: ['DIRECTOR'], levels: [30, 40] };

    await ctrl.list(directorUser, {});

    expect(listUCMock).toHaveBeenCalledWith(
      expect.objectContaining({ levelIn: [30, 40] }),
    );
  });

  it('ADMIN (allLevels=true) passes levelIn=undefined to listUC', async () => {
    const listUCMock = vi.fn().mockResolvedValue(makeListResult([makeCC('cc-admin-1')]));
    const ctrl = makeController({ listUC: { execute: listUCMock } });
    const adminUser = { userId: 'admin-id', roles: ['ADMIN'], levels: [] };

    await ctrl.list(adminUser, {});

    expect(listUCMock).toHaveBeenCalled();
    const call = listUCMock.mock.calls[0][0];
    expect(call.levelIn).toBeUndefined();
  });

  it('TEACHER (non-administrative) goes through listTeacherCCsUC path, not listUC', async () => {
    const listUCMock = vi.fn().mockResolvedValue(makeListResult([]));
    const teacherMock = vi.fn().mockResolvedValue([makeTeacherCC('cc-t-1')]);
    const ctrl = makeController({
      listUC: { execute: listUCMock },
      listTeacherCCsUC: { execute: teacherMock },
    });
    const teacherUser = { userId: 'teacher-id', roles: ['TEACHER'], levels: [20] };

    const result = await ctrl.list(teacherUser, {});

    expect(teacherMock).toHaveBeenCalledWith({ userId: 'teacher-id', mode: 'subject' });
    expect(listUCMock).not.toHaveBeenCalled();
    expect(result).toHaveProperty('data');
  });

  it('PRECEPTOR (non-administrative) goes through listTeacherCCsUC path', async () => {
    const listUCMock = vi.fn();
    const teacherMock = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({
      listUC: { execute: listUCMock },
      listTeacherCCsUC: { execute: teacherMock },
    });
    const preceptorUser = { userId: 'prec-id', roles: ['PRECEPTOR'], levels: [20] };

    await ctrl.list(preceptorUser, {});

    expect(teacherMock).toHaveBeenCalled();
    expect(listUCMock).not.toHaveBeenCalled();
  });

  it('ROOT with teacherUserId still delegates to listTeacherCCsUC', async () => {
    const listUCMock = vi.fn();
    const teacherMock = vi.fn().mockResolvedValue([makeTeacherCC('cc-r-1')]);
    const ctrl = makeController({
      listUC: { execute: listUCMock },
      listTeacherCCsUC: { execute: teacherMock },
    });
    const rootUser = { userId: 'root-id', roles: ['ROOT'] };

    await ctrl.list(rootUser, { teacherUserId: 'some-teacher' });

    expect(teacherMock).toHaveBeenCalledWith({ userId: 'some-teacher', mode: 'subject' });
    expect(listUCMock).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /course-cycles/:id/subjects — teacher subjects in a CC
// ═══════════════════════════════════════════════════════════════════════════════

describe('CourseCycleController — GET :id/subjects', () => {
  it('TIA-R4: non-ROOT uses JWT userId (ignores query teacherUserId)', async () => {
    const subjectsMock = vi.fn().mockResolvedValue([{ subjectId: 'subj-1', subjectName: 'Matemática' }]);
    const ctrl = makeController({ listTeacherSubjectsUC: { execute: subjectsMock } });
    const teacherUser = { userId: 'user-uuid-1', roles: ['TEACHER'] };

    await ctrl.listSubjects('cc-uuid-1', teacherUser, {});

    expect(subjectsMock).toHaveBeenCalledWith({
      userId: 'user-uuid-1',  // from JWT
      courseCycleId: 'cc-uuid-1',
    });
  });

  it('TIA-R4: ROOT can override userId via query teacherUserId', async () => {
    const subjectsMock = vi.fn().mockResolvedValue([{ subjectId: 'subj-1', subjectName: 'Matemática' }]);
    const ctrl = makeController({ listTeacherSubjectsUC: { execute: subjectsMock } });
    const rootUser = { userId: 'root-id', roles: ['ROOT'] };

    await ctrl.listSubjects('cc-uuid-1', rootUser, { teacherUserId: 'target-teacher' });

    expect(subjectsMock).toHaveBeenCalledWith({
      userId: 'target-teacher',  // ROOT admin override
      courseCycleId: 'cc-uuid-1',
    });
  });

  it('returns { data } wrapper', async () => {
    const ctrl = makeController();
    const user = { userId: 'user-1', roles: ['TEACHER'] };

    const result = await ctrl.listSubjects('cc-uuid-1', user, {});

    expect(result).toHaveProperty('data');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('TIA-R7: CC not found → empty array 200', async () => {
    const subjectsMock = vi.fn().mockResolvedValue([]);
    const ctrl = makeController({ listTeacherSubjectsUC: { execute: subjectsMock } });
    const user = { userId: 'user-1', roles: ['TEACHER'] };

    const result = await ctrl.listSubjects('non-existent', user, {});

    expect(result.data).toEqual([]);
  });

  it('teacherUserId in query is now optional (non-ROOT derives from JWT)', async () => {
    const { ZodValidationPipe } = await import('../../shared/pipes/zod-validation.pipe');
    const { TeacherSubjectsQuerySchema } = await import('../../grading/dto/subject-grades.dto');
    const pipe = new ZodValidationPipe(TeacherSubjectsQuerySchema);

    // Should NOT throw — teacherUserId is optional for non-ROOT (JWT provides it)
    expect(() => pipe.transform({}, {} as any)).not.toThrow();
  });
});
