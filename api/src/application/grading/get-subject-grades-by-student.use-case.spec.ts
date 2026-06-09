/**
 * PR4-T5 [RED] — GetSubjectGradesByStudentUseCase tests.
 * Specs: SFG-R10, ES-R2 (CORRECTED — all competencies), AD-7
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSubjectGradesByStudentUseCase } from './get-subject-grades-by-student.use-case';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import { SubjectGradingPeriod, SubjectPeriodGrade } from '@educandow/domain';

vi.mock('../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePeriod(ordinal: number, subjectId = 'subj-1'): SubjectGradingPeriod {
  return SubjectGradingPeriod.snapshotFromTemplateItem({
    courseCycleId: 'cc-uuid-1',
    subjectId,
    sortOrder: ordinal,
    name: `Período ${ordinal}`,
  });
}

function makeRepos(overrides: Partial<{
  periodGradeResult: SubjectPeriodGrade[];
  finalGradeResult: unknown[];
}> = {}) {
  return {
    sgpRepo: {
      ensureSnapshot: vi.fn().mockResolvedValue([]),
    },
    periodGradeRepo: {
      findByStudentAndCourseCycle: vi.fn().mockResolvedValue(overrides.periodGradeResult ?? []),
      saveMany: vi.fn().mockResolvedValue(undefined),
    },
    finalGradeRepo: {
      findByStudentAndCourseCycle: vi.fn().mockResolvedValue(overrides.finalGradeResult ?? []),
      saveMany: vi.fn().mockResolvedValue(undefined),
    },
    cvRepo: {
      findByCourseCycleAndStudyPlanSubject: vi.fn().mockResolvedValue([]),
    },
    // Default: authorized teacher — homeroom or has assignment in the CC
    teacherRepo: {
      findByUserId: vi.fn().mockResolvedValue({ id: { get: () => 'teacher-1' } }),
    },
    assignmentRepo: {
      // Assignment in cs-A (matches default mockClient cc.courseId)
      findByTeacher: vi.fn().mockResolvedValue([{ courseSectionId: 'cs-A', subjectId: 'subj-1' }]),
    },
  };
}

function makeMockClient(subjects: { id: string; name: string }[] = [{ id: 'subj-1', name: 'Matemática' }]) {
  return {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue({ studyPlanId: 'sp-1', courseId: 'cs-A' }),
    },
    studyPlanCourse: {
      findFirst: vi.fn().mockResolvedValue({ id: 'spc-1', subjects: subjects.map((s) => ({ subjectId: s.id })) }),
    },
    studyPlanSubject: {
      findMany: vi.fn().mockResolvedValue(subjects.map((s) => ({ id: `sps-${s.id}`, subjectId: s.id, subject: { id: s.id, name: s.name } }))),
      findFirst: vi.fn().mockResolvedValue({ id: 'sps-subj-1' }),
    },
    subject: {
      findMany: vi.fn().mockResolvedValue(subjects),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GetSubjectGradesByStudentUseCase
// ═══════════════════════════════════════════════════════════════════════════════

describe('GetSubjectGradesByStudentUseCase', () => {
  let useCase: GetSubjectGradesByStudentUseCase;
  let repos: ReturnType<typeof makeRepos>;
  let mockClient: ReturnType<typeof makeMockClient>;

  const AUTH = { userId: 'user-teacher-1', userRoles: ['TEACHER'] as string[] };

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    repos = makeRepos();
    useCase = new GetSubjectGradesByStudentUseCase(
      repos.sgpRepo as any,
      repos.periodGradeRepo as any,
      repos.finalGradeRepo as any,
      repos.cvRepo as any,
      repos.teacherRepo as any,
      repos.assignmentRepo as any,
    );
  });

  it('returns empty subjects when CC not found', async () => {
    mockClient.courseCycle.findUnique.mockResolvedValue(null);

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', studentId: 'student-1', ...AUTH });

    // null CC returns forbidden since ownership cannot be verified
    expect(result).toEqual({ forbidden: true });
  });

  it('returns subjects from study plan for the CC (authorized teacher with assignment)', async () => {
    repos.sgpRepo.ensureSnapshot.mockResolvedValue([makePeriod(1)]);
    const grade = SubjectPeriodGrade.create({ studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-1', periodOrdinal: 1 });
    repos.periodGradeRepo.findByStudentAndCourseCycle.mockResolvedValue([grade]);

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', studentId: 'student-1', ...AUTH });

    expect(result).not.toHaveProperty('forbidden');
    const res = result as any;
    expect(res.subjects).toHaveLength(1);
    expect(res.subjects[0].subjectId).toBe('subj-1');
    expect(res.subjects[0].subjectName).toBe('Matemática');
  });

  it('each subject has all 4 final grade types (absent = null values)', async () => {
    repos.sgpRepo.ensureSnapshot.mockResolvedValue([makePeriod(1)]);
    const grade = SubjectPeriodGrade.create({ studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-1', periodOrdinal: 1 });
    repos.periodGradeRepo.findByStudentAndCourseCycle.mockResolvedValue([grade]);
    repos.finalGradeRepo.findByStudentAndCourseCycle.mockResolvedValue([]);  // no finals yet

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', studentId: 'student-1', ...AUTH });

    const res = result as any;
    const subject = res.subjects[0];
    expect(subject.finalGrades).toHaveLength(4);
    const types = subject.finalGrades.map((f: any) => f.type);
    expect(types).toContain('FINAL');
    expect(types).toContain('DICIEMBRE');
    expect(types).toContain('MARZO');
    expect(types).toContain('DEFINITIVA');
  });

  it('includes ALL competency valuations (imprimible not filtered) — ES-R2 corrected', async () => {
    repos.sgpRepo.ensureSnapshot.mockResolvedValue([makePeriod(1)]);
    const grade = SubjectPeriodGrade.create({ studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-1', periodOrdinal: 1 });
    repos.periodGradeRepo.findByStudentAndCourseCycle.mockResolvedValue([grade]);
    repos.cvRepo.findByCourseCycleAndStudyPlanSubject.mockResolvedValue([
      {
        valuationId: 'val-1', studentId: 'student-1', competencyId: 'comp-1',
        periodValuations: [
          { periodItemId: 'pv-1', imprimible: true, gradeCode: 'MB', gradeScaleValueId: 'gv-1', internalStatus: null, modificable: true },
          { periodItemId: 'pv-2', imprimible: false, gradeCode: null, gradeScaleValueId: null, internalStatus: null, modificable: true },
        ],
      },
    ]);

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', studentId: 'student-1', ...AUTH });

    const res = result as any;
    const cv = res.subjects[0].competencyValuations[0];
    // BOTH period valuations returned — no imprimible filter
    expect(cv.periodValuations).toHaveLength(2);
  });

  it('tenant scoping: uses CC courseId to resolve study plan subjects', async () => {
    repos.sgpRepo.ensureSnapshot.mockResolvedValue([makePeriod(1)]);
    repos.periodGradeRepo.findByStudentAndCourseCycle.mockResolvedValue([]);

    await useCase.execute({ courseCycleId: 'cc-uuid-1', studentId: 'student-1', ...AUTH });

    // courseCycle.findUnique is called at least once (authz check + subject resolution)
    expect(mockClient.courseCycle.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { uuid: 'cc-uuid-1' } }),
    );
  });

  it('does NOT pre-create SubjectFinalGrade rows on read (absent = null values)', async () => {
    repos.sgpRepo.ensureSnapshot.mockResolvedValue([makePeriod(1)]);
    const grade = SubjectPeriodGrade.create({ studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-1', periodOrdinal: 1 });
    repos.periodGradeRepo.findByStudentAndCourseCycle.mockResolvedValue([grade]);
    repos.finalGradeRepo.findByStudentAndCourseCycle.mockResolvedValue([]);  // no FINAL yet

    await useCase.execute({ courseCycleId: 'cc-uuid-1', studentId: 'student-1', ...AUTH });

    // C1 fix: finalGradeRepo.saveMany must NOT be called on GET
    expect(repos.finalGradeRepo.saveMany).not.toHaveBeenCalled();
  });

  // ── AUTHZ-C1: by-student ownership checks ─────────────────────────────────

  it('AUTHZ-C1: teacher who is neither homeroom nor assigned to CC returns { forbidden: true }', async () => {
    // CC has no homeroomTeacherId matching teacher-1, and no assignment
    mockClient.courseCycle.findUnique.mockResolvedValue({
      studyPlanId: 'sp-1', courseId: 'cs-A', homeroomTeacherId: 'other-teacher',
    });
    repos.teacherRepo = { findByUserId: vi.fn().mockResolvedValue({ id: { get: () => 'teacher-1' } }) };
    repos.assignmentRepo = { findByTeacher: vi.fn().mockResolvedValue([]) };  // no assignments
    useCase = new GetSubjectGradesByStudentUseCase(
      repos.sgpRepo as any, repos.periodGradeRepo as any,
      repos.finalGradeRepo as any, repos.cvRepo as any,
      repos.teacherRepo as any, repos.assignmentRepo as any,
    );

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', studentId: 'student-1', ...AUTH });

    expect(result).toEqual({ forbidden: true });
  });

  it('AUTHZ-C1: homeroom teacher can access by-student (homeroom path)', async () => {
    // CC.homeroomTeacherId matches teacher-1
    mockClient.courseCycle.findUnique.mockResolvedValue({
      studyPlanId: 'sp-1', courseId: 'cs-A', homeroomTeacherId: 'teacher-1',
    });
    repos.teacherRepo = { findByUserId: vi.fn().mockResolvedValue({ id: { get: () => 'teacher-1' } }) };
    repos.assignmentRepo = { findByTeacher: vi.fn().mockResolvedValue([]) };  // no subject assignment
    repos.sgpRepo.ensureSnapshot.mockResolvedValue([makePeriod(1)]);
    repos.periodGradeRepo.findByStudentAndCourseCycle.mockResolvedValue([]);
    useCase = new GetSubjectGradesByStudentUseCase(
      repos.sgpRepo as any, repos.periodGradeRepo as any,
      repos.finalGradeRepo as any, repos.cvRepo as any,
      repos.teacherRepo as any, repos.assignmentRepo as any,
    );

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', studentId: 'student-1', ...AUTH });

    // Not forbidden — homeroom access is sufficient
    expect(result).not.toEqual({ forbidden: true });
  });

  it('AUTHZ-C1: ROOT bypasses ownership check', async () => {
    repos.teacherRepo = { findByUserId: vi.fn() };
    repos.assignmentRepo = { findByTeacher: vi.fn() };
    repos.sgpRepo.ensureSnapshot.mockResolvedValue([]);
    useCase = new GetSubjectGradesByStudentUseCase(
      repos.sgpRepo as any, repos.periodGradeRepo as any,
      repos.finalGradeRepo as any, repos.cvRepo as any,
      repos.teacherRepo as any, repos.assignmentRepo as any,
    );

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', studentId: 'student-1', userId: 'root-id', userRoles: ['ROOT'] });

    expect(result).not.toEqual({ forbidden: true });
    expect(repos.teacherRepo.findByUserId).not.toHaveBeenCalled();
  });
});
