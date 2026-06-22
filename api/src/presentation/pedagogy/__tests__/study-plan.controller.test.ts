import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PedagogyController } from '../pedagogy.controller';
import { StudyPlanHasDependenciesError } from '@educandow/domain';
import { err, ok } from '@educandow/domain';

// ── T14: esOptativa ──────────────────────────────────────────

describe('PedagogyController — addSubjectToPlanCourse esOptativa', () => {
  let ctrl: PedagogyController;
  const mockAddSubjectUC = { execute: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    ctrl = Object.create(PedagogyController.prototype) as PedagogyController;
    (ctrl as unknown as Record<string, unknown>)['addSubjectUC'] = mockAddSubjectUC;
  });

  it('Test A (MGC-S29): passes esOptativa: true to UC when provided in body', async () => {
    mockAddSubjectUC.execute.mockResolvedValue(ok(undefined));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.addSubjectToPlanCourse('plan-course-1', { subjectId: 'sub-uuid-1', esOptativa: true } as any);
    expect(mockAddSubjectUC.execute).toHaveBeenCalledWith('plan-course-1', 'sub-uuid-1', undefined, true);
  });

  it('Test B (D4): passes esOptativa: undefined to UC when omitted (4 args, 4th is undefined)', async () => {
    mockAddSubjectUC.execute.mockResolvedValue(ok(undefined));
    await ctrl.addSubjectToPlanCourse('plan-course-1', { subjectId: 'sub-uuid-1' });
    const call = mockAddSubjectUC.execute.mock.calls[0];
    expect(call).toHaveLength(4);
    expect(call[3]).toBeUndefined();
  });
});

describe('PedagogyController — listPlanCourseSubjects includes esOptativa', () => {
  let ctrl: PedagogyController;
  const mockGetPlanCourseUC = { execute: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    ctrl = Object.create(PedagogyController.prototype) as PedagogyController;
    (ctrl as unknown as Record<string, unknown>)['getPlanCourseUC'] = mockGetPlanCourseUC;
  });

  it('Test C (MGC-S38): response includes esOptativa for each subject', async () => {
    mockGetPlanCourseUC.execute.mockResolvedValue({
      id: 'pc-1',
      studyPlanId: 'sp-1',
      courseSectionId: 'cs-1',
      subjects: [
        { id: 'ps-1', subjectId: 'sub-1', subjectName: 'Matemática', hoursPerWeek: 4, esOptativa: true },
        { id: 'ps-2', subjectId: 'sub-2', subjectName: 'Lengua', hoursPerWeek: 3, esOptativa: false },
      ],
    });
    const result = await ctrl.listPlanCourseSubjects('pc-1');
    expect(result.data[0]).toHaveProperty('esOptativa', true);
    expect(result.data[1]).toHaveProperty('esOptativa', false);
  });
});

describe('PedagogyController — getPlan subjects include esOptativa', () => {
  let ctrl: PedagogyController;
  const mockGetPlanUC = { execute: vi.fn() };
  const mockListPlanCoursesUC = { execute: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    ctrl = Object.create(PedagogyController.prototype) as PedagogyController;
    (ctrl as unknown as Record<string, unknown>)['getPlanUC'] = mockGetPlanUC;
    (ctrl as unknown as Record<string, unknown>)['listPlanCoursesUC'] = mockListPlanCoursesUC;
  });

  it('Test D (MGC-S38): getPlan subjects map includes esOptativa per entry', async () => {
    mockGetPlanUC.execute.mockResolvedValue({
      id: { get: () => 'plan-1' },
      name: 'Plan Test', level: 2, modality: 0, cycleUuid: null, active: true,
    });
    mockListPlanCoursesUC.execute.mockResolvedValue([{
      id: 'pc-1', courseSectionId: 'cs-1', courseSectionName: 'Sección A', studyPlanId: 'sp-1',
      subjects: [
        { id: 'ps-1', subjectId: 'sub-1', subjectName: 'Matemática', hoursPerWeek: 4, esOptativa: true },
      ],
    }]);
    const result = await ctrl.getPlan('plan-1');
    const subj = result.data!.courses[0].subjects[0];
    expect(subj).toHaveProperty('esOptativa', true);
  });
});

describe('PedagogyController — deletePlan', () => {
  let ctrl: PedagogyController;
  const mockDeletePlanUC = { execute: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    // Instantiate a minimal controller by bypassing the constructor
    ctrl = Object.create(PedagogyController.prototype) as PedagogyController;
    (ctrl as unknown as Record<string, unknown>)['deletePlanUC'] = mockDeletePlanUC;
  });

  it('throws HttpException 409 with structured body when UC returns err(StudyPlanHasDependenciesError)', async () => {
    const depError = new StudyPlanHasDependenciesError(1, 0);
    mockDeletePlanUC.execute.mockResolvedValue(err(depError));

    await expect(ctrl.deletePlan('plan-1')).rejects.toThrow(HttpException);

    try {
      await ctrl.deletePlan('plan-1');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      const ex = e as HttpException;
      expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
      const body = ex.getResponse() as { error: { message: string; code: string; details: { courseCount: number; courseCycleCount: number } } };
      expect(body.error.code).toBe('STUDY_PLAN_HAS_DEPENDENCIES');
      expect(body.error.details.courseCount).toBe(1);
      expect(body.error.details.courseCycleCount).toBe(0);
      expect(body.error.message).toBe(depError.message);
    }
  });

  it('does not throw when UC returns ok(void)', async () => {
    mockDeletePlanUC.execute.mockResolvedValue(ok(undefined));

    await expect(ctrl.deletePlan('plan-2')).resolves.not.toThrow();
  });
});
