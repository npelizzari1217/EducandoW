/**
 * GetSubjectGradesBySubjectUseCase tests — authz via AssignmentAuthorizer (modelo nuevo).
 *
 * notas-get-authz-grupo: migrated from canWriteGrades (boolean gate) to
 * getAllowedStudentIds (tri-state scope filter). Adds F5-T8 and F5-T9 scenarios.
 * Specs: SPG-R8, ES-R1 (CORRECTED), AD-5, AD-7, ADR-4, ADR-6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSubjectGradesBySubjectUseCase } from './get-subject-grades-by-subject.use-case';
import { TenantContext } from '../../infrastructure/auth/tenant.context';
import { SubjectGradingPeriod, SubjectPeriodGrade, SubjectFinalGrade, SubjectFinalGradeType, SubjectFinalGradeCondicion } from '@educandow/domain';

vi.mock('../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePeriod(ordinal: number): SubjectGradingPeriod {
  return SubjectGradingPeriod.snapshotFromTemplateItem({
    courseCycleId: 'cc-uuid-1',
    subjectId: 'subj-uuid-1',
    sortOrder: ordinal,
    name: `Período ${ordinal}`,
  });
}

/**
 * Authorizer mock with tri-state getAllowedStudentIds.
 *
 * scope:
 *   'all'   → administrative bypass (default for existing tests)
 *   null    → forbidden
 *   string[] → scoped student list
 */
function makeAuthorizer(scope: string[] | 'all' | null = 'all') {
  return {
    getAllowedStudentIds: vi.fn().mockResolvedValue(scope),
    canAccessCourseCycle: vi.fn().mockResolvedValue(scope !== null),
  };
}

function makeRepos(overrides: Partial<{
  sgpRepoResult: SubjectGradingPeriod[];
  periodGradeResult: SubjectPeriodGrade[];
  finalGradeResult: unknown[];
  cvResult: unknown[];
  enrolledStudents: { studentId: string; firstName: string; lastName: string }[];
}> = {}) {
  const periods = overrides.sgpRepoResult ?? [];
  const periodGrades = overrides.periodGradeResult ?? [];
  const finalGrades = overrides.finalGradeResult ?? [];
  const cvResult = overrides.cvResult ?? [];
  const students = overrides.enrolledStudents ?? [];

  return {
    sgpRepo: {
      ensureSnapshot: vi.fn().mockResolvedValue(periods),
      findByCourseCycleAndSubject: vi.fn().mockResolvedValue(periods),
    },
    periodGradeRepo: {
      findByCourseCycleAndSubject: vi.fn().mockResolvedValue(periodGrades),
      saveMany: vi.fn().mockResolvedValue(undefined),
    },
    finalGradeRepo: {
      findByCourseCycleAndSubject: vi.fn().mockResolvedValue(finalGrades),
      saveMany: vi.fn().mockResolvedValue(undefined),
    },
    cvRepo: {
      findByCourseCycleAndStudyPlanSubject: vi.fn().mockResolvedValue(cvResult),
    },
    ccRepo: {
      findEnrolledStudents: vi.fn().mockResolvedValue(students),
    },
  };
}

function makeMockClient(overrides: {
  cc?: unknown;
  spc?: unknown;
  sps?: unknown;
} = {}) {
  return {
    courseCycle: {
      findUnique: vi.fn().mockResolvedValue(
        overrides.cc ?? { studyPlanId: 'sp-1', courseId: 'cs-A' },
      ),
    },
    studyPlanCourse: {
      findFirst: vi.fn().mockResolvedValue(
        overrides.spc ?? { id: 'spc-1' },
      ),
    },
    studyPlanSubject: {
      findFirst: vi.fn().mockResolvedValue(
        overrides.sps ?? { id: 'sps-uuid-1' },
      ),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GetSubjectGradesBySubjectUseCase
// ═══════════════════════════════════════════════════════════════════════════════

describe('GetSubjectGradesBySubjectUseCase', () => {
  let useCase: GetSubjectGradesBySubjectUseCase;
  let repos: ReturnType<typeof makeRepos>;
  let mockClient: ReturnType<typeof makeMockClient>;
  let authorizer: ReturnType<typeof makeAuthorizer>;

  beforeEach(() => {
    mockClient = makeMockClient();
    vi.mocked(TenantContext.getClient).mockReturnValue(mockClient as any);
    authorizer = makeAuthorizer('all'); // 'all' scope by default (admin bypass)
  });

  function makeUseCase(r = repos, auth = authorizer) {
    return new GetSubjectGradesBySubjectUseCase(
      r.sgpRepo as any, r.periodGradeRepo as any,
      r.finalGradeRepo as any, r.cvRepo as any, r.ccRepo as any,
      auth as any,
    );
  }
  const AUTH = { userId: 'user-teacher-1', userRoles: ['TEACHER'] as string[] };

  it('returns empty students array when no enrolled students', async () => {
    repos = makeRepos({ sgpRepoResult: [makePeriod(1), makePeriod(2)], enrolledStudents: [] });
    useCase = makeUseCase();

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

    expect(result).not.toHaveProperty('forbidden');
    const res = result as any;
    expect(res.students).toEqual([]);
    expect(res.periods).toHaveLength(2);
  });

  it('returns empty periods array when snapshot returns no periods', async () => {
    repos = makeRepos({ sgpRepoResult: [], enrolledStudents: [] });
    useCase = makeUseCase();

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

    expect(result).not.toHaveProperty('forbidden');
    const res = result as any;
    expect(res.periods).toEqual([]);
    expect(res.students).toEqual([]);
  });

  it('calls ensureSnapshot with correct courseCycleId and subjectId', async () => {
    repos = makeRepos({ sgpRepoResult: [], enrolledStudents: [] });
    useCase = makeUseCase();

    await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

    expect(repos.sgpRepo.ensureSnapshot).toHaveBeenCalledWith('cc-uuid-1', 'subj-uuid-1');
  });

  it('does NOT pre-create SubjectPeriodGrade rows on read (absent row = ungraded)', async () => {
    const periods = [makePeriod(1), makePeriod(2)];
    repos = makeRepos({
      sgpRepoResult: periods,
      periodGradeResult: [],
      enrolledStudents: [{ studentId: 'student-1', firstName: 'Juan', lastName: 'García' }],
    });
    useCase = makeUseCase();

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

    expect(repos.periodGradeRepo.saveMany).not.toHaveBeenCalled();
    const res = result as any;
    expect(res.students[0].periodGrades).toEqual([]);
  });

  it('does NOT pre-create SubjectFinalGrade rows on read (absent = null values)', async () => {
    const periods = [makePeriod(1)];
    repos = makeRepos({
      sgpRepoResult: periods,
      periodGradeResult: [],
      finalGradeResult: [],
      enrolledStudents: [{ studentId: 'student-1', firstName: 'Juan', lastName: 'García' }],
    });
    useCase = makeUseCase();

    await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

    expect(repos.finalGradeRepo.saveMany).not.toHaveBeenCalled();
  });

  it('response contains all 4 final grade types per student (absent = null values)', async () => {
    const periods = [makePeriod(1)];
    const grade = SubjectPeriodGrade.create({ studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', periodOrdinal: 1 });
    repos = makeRepos({
      sgpRepoResult: periods,
      periodGradeResult: [grade],
      finalGradeResult: [],
      enrolledStudents: [{ studentId: 'student-1', firstName: 'Juan', lastName: 'García' }],
    });
    useCase = makeUseCase();

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

    const res = result as any;
    const student = res.students[0];
    const types = student.finalGrades.map((f: any) => f.type);
    expect(types).toContain('FINAL');
    expect(types).toContain('DICIEMBRE');
    expect(types).toContain('MARZO');
    expect(types).toContain('DEFINITIVA');
  });

  it('returns ALL competency valuations with imprimible field (no pre-filter by imprimible)', async () => {
    const periods = [makePeriod(1)];
    const grade = SubjectPeriodGrade.create({ studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', periodOrdinal: 1 });
    const cvWithBothImprimible = [
      {
        valuationId: 'val-1', studentId: 'student-1', competencyId: 'comp-1',
        periodValuations: [
          { periodItemId: 'pv-1', gradeScaleValueId: null, gradeCode: null, internalStatus: null, modificable: true, imprimible: true },
          { periodItemId: 'pv-2', gradeScaleValueId: null, gradeCode: null, internalStatus: null, modificable: true, imprimible: false },
        ],
      },
    ];
    repos = makeRepos({
      sgpRepoResult: periods,
      periodGradeResult: [grade],
      cvResult: cvWithBothImprimible,
      enrolledStudents: [{ studentId: 'student-1', firstName: 'Juan', lastName: 'García' }],
    });
    useCase = makeUseCase();

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

    const res = result as any;
    const student = res.students[0];
    const cv = student.competencyValuations[0];
    expect(cv.periodValuations).toHaveLength(2);
    expect(cv.periodValuations[0].imprimible).toBe(true);
    expect(cv.periodValuations[1].imprimible).toBe(false);
  });

  it('tenant scoping: calls cvRepo.findByCourseCycleAndStudyPlanSubject with resolved studyPlanSubjectId', async () => {
    const periods = [makePeriod(1)];
    const grade = SubjectPeriodGrade.create({ studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', periodOrdinal: 1 });
    repos = makeRepos({
      sgpRepoResult: periods,
      periodGradeResult: [grade],
      enrolledStudents: [{ studentId: 'student-1', firstName: 'Juan', lastName: 'García' }],
    });
    useCase = makeUseCase();

    await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

    expect(repos.cvRepo.findByCourseCycleAndStudyPlanSubject).toHaveBeenCalledWith(
      'cc-uuid-1',
      'sps-uuid-1',
    );
  });

  it('skips competency fetch when studyPlanSubjectId cannot be resolved', async () => {
    mockClient.studyPlanSubject.findFirst.mockResolvedValue(null);
    const periods = [makePeriod(1)];
    const grade = SubjectPeriodGrade.create({ studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', periodOrdinal: 1 });
    repos = makeRepos({
      sgpRepoResult: periods,
      periodGradeResult: [grade],
      enrolledStudents: [{ studentId: 'student-1', firstName: 'Juan', lastName: 'García' }],
    });
    useCase = makeUseCase();

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', userId: 'user-1', userRoles: ['TEACHER'] });

    expect(repos.cvRepo.findByCourseCycleAndStudyPlanSubject).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty('forbidden');
    const res = result as any;
    expect(res.students[0].competencyValuations).toEqual([]);
  });

  // ── AUTHZ-C1: scope gate via getAllowedStudentIds ────────────────────────────

  it('AUTHZ-C1: getAllowedStudentIds returns null → { forbidden: true }', async () => {
    repos = makeRepos({ sgpRepoResult: [makePeriod(1)], enrolledStudents: [] });
    const auth = makeAuthorizer(null); // forbidden
    useCase = makeUseCase(repos, auth);

    const result = await useCase.execute({
      courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1',
      userId: 'unknown-user', userRoles: ['TEACHER'],
    });

    expect(result).toEqual({ forbidden: true });
    expect(auth.getAllowedStudentIds).toHaveBeenCalledWith('unknown-user', ['TEACHER'], 'cc-uuid-1', 'subj-uuid-1');
  });

  it('AUTHZ-C1: getAllowedStudentIds returns "all" → success (not forbidden)', async () => {
    repos = makeRepos({ sgpRepoResult: [], enrolledStudents: [] });
    const auth = makeAuthorizer('all');
    useCase = makeUseCase(repos, auth);

    const result = await useCase.execute({
      courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1',
      userId: 'user-teacher', userRoles: ['TEACHER'],
    });

    expect(result).not.toEqual({ forbidden: true });
  });

  it('AUTHZ-C1: ROOT → getAllowedStudentIds returns "all" (bypass managed by authorizer)', async () => {
    repos = makeRepos({ sgpRepoResult: [], enrolledStudents: [] });
    const auth = makeAuthorizer('all');
    useCase = makeUseCase(repos, auth);

    const result = await useCase.execute({
      courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1',
      userId: 'root-user', userRoles: ['ROOT'],
    });

    expect(result).not.toEqual({ forbidden: true });
    expect(auth.getAllowedStudentIds).toHaveBeenCalledWith('root-user', ['ROOT'], 'cc-uuid-1', 'subj-uuid-1');
  });

  it('AUTHZ-C1: getAllowedStudentIds es llamado con los parámetros correctos', async () => {
    repos = makeRepos({ sgpRepoResult: [], enrolledStudents: [] });
    const auth = makeAuthorizer('all');
    useCase = makeUseCase(repos, auth);

    await useCase.execute({
      courseCycleId: 'cc-X', subjectId: 'subj-Y',
      userId: 'user-Z', userRoles: ['TEACHER'],
    });

    expect(auth.getAllowedStudentIds).toHaveBeenCalledWith('user-Z', ['TEACHER'], 'cc-X', 'subj-Y');
  });

  // ── F5-T8: scope filter — TEACHER sees only their grupo's students ───────────

  it('F5-T8: getAllowedStudentIds returns ["s1","s2"] → students[] contains only s1 and s2', async () => {
    const periods = [makePeriod(1)];
    repos = makeRepos({
      sgpRepoResult: periods,
      enrolledStudents: [
        { studentId: 's1', firstName: 'Ana', lastName: 'García' },
        { studentId: 's2', firstName: 'Bob', lastName: 'Pérez' },
        { studentId: 's3', firstName: 'Carlos', lastName: 'López' }, // outside scope
      ],
    });
    const auth = makeAuthorizer(['s1', 's2']);
    useCase = makeUseCase(repos, auth);

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

    expect(result).not.toHaveProperty('forbidden');
    const res = result as any;
    const ids = res.students.map((s: any) => s.studentId);
    expect(ids).toContain('s1');
    expect(ids).toContain('s2');
    expect(ids).not.toContain('s3');
  });

  // ── F5-T9: cross-scope exclusion ────────────────────────────────────────────

  it('F5-T9: getAllowedStudentIds returns ["s1"] → s2 and s3 are absent', async () => {
    const periods = [makePeriod(1)];
    repos = makeRepos({
      sgpRepoResult: periods,
      enrolledStudents: [
        { studentId: 's1', firstName: 'Ana', lastName: 'García' },
        { studentId: 's2', firstName: 'Bob', lastName: 'Pérez' },
        { studentId: 's3', firstName: 'Carlos', lastName: 'López' },
      ],
    });
    const auth = makeAuthorizer(['s1']);
    useCase = makeUseCase(repos, auth);

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

    const res = result as any;
    expect(res.students).toHaveLength(1);
    expect(res.students[0].studentId).toBe('s1');
  });

  // ── Empty scope (grupo vacío) — 200 not 403 ──────────────────────────────────

  it('GRUPO-VACÍO: getAllowedStudentIds returns [] → result is NOT forbidden; students[] = []', async () => {
    const periods = [makePeriod(1)];
    repos = makeRepos({
      sgpRepoResult: periods,
      enrolledStudents: [{ studentId: 's1', firstName: 'Ana', lastName: 'García' }],
    });
    const auth = makeAuthorizer([]);
    useCase = makeUseCase(repos, auth);

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

    expect(result).not.toHaveProperty('forbidden');
    const res = result as any;
    expect(res.students).toEqual([]);
  });

  // ── 'all' scope — no filtering, all enrolled students returned ───────────────

  it('ALL-SCOPE: getAllowedStudentIds returns "all" → all enrolled students returned', async () => {
    const periods = [makePeriod(1)];
    repos = makeRepos({
      sgpRepoResult: periods,
      enrolledStudents: [
        { studentId: 's1', firstName: 'A', lastName: 'B' },
        { studentId: 's2', firstName: 'C', lastName: 'D' },
        { studentId: 's3', firstName: 'E', lastName: 'F' },
      ],
    });
    const auth = makeAuthorizer('all');
    useCase = makeUseCase(repos, auth);

    const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', userId: 'admin', userRoles: ['SECRETARIO'] });

    const res = result as any;
    expect(res.students).toHaveLength(3);
  });

  // ── condicion in response ─────────────────────────────────────────────────────

  describe('condicion in response', () => {
    it('COND-S9: finalGrades[] entries include condicion for a row with condicion=PREVIA', async () => {
      const periods = [makePeriod(1)];
      const finalWithPrevia = SubjectFinalGrade.reconstruct({
        id: 'sfg-final-1',
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-uuid-1',
        type: SubjectFinalGradeType.FINAL,
        gradeScaleValueId: null,
        gradeCode: null,
        internalStatus: null,
        passed: false,
        condicion: SubjectFinalGradeCondicion.PREVIA,
      });
      repos = makeRepos({
        sgpRepoResult: periods,
        finalGradeResult: [finalWithPrevia],
        enrolledStudents: [{ studentId: 'student-1', firstName: 'Ana', lastName: 'López' }],
      });
      useCase = makeUseCase(repos);

      const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

      const res = result as any;
      const student = res.students[0];
      const finalEntry = student.finalGrades.find((f: any) => f.type === 'FINAL');
      expect(finalEntry).toBeDefined();
      expect(finalEntry.condicion).toBe('PREVIA');
    });

    it('COND-S8: Primario row (condicion=null) returns condicion: null (not undefined)', async () => {
      const periods = [makePeriod(1)];
      const finalNullCondicion = SubjectFinalGrade.reconstruct({
        id: 'sfg-final-2',
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-uuid-1',
        type: SubjectFinalGradeType.FINAL,
        gradeScaleValueId: null,
        gradeCode: null,
        internalStatus: null,
        passed: null,
        condicion: null,
      });
      repos = makeRepos({
        sgpRepoResult: periods,
        finalGradeResult: [finalNullCondicion],
        enrolledStudents: [{ studentId: 'student-1', firstName: 'Ana', lastName: 'López' }],
      });
      useCase = makeUseCase(repos);

      const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

      const res = result as any;
      const finalEntry = res.students[0].finalGrades.find((f: any) => f.type === 'FINAL');
      expect(finalEntry.condicion).toBeNull();
    });

    it('absent final grade row returns condicion: null (not undefined)', async () => {
      const periods = [makePeriod(1)];
      repos = makeRepos({
        sgpRepoResult: periods,
        finalGradeResult: [],
        enrolledStudents: [{ studentId: 'student-1', firstName: 'Ana', lastName: 'López' }],
      });
      useCase = makeUseCase(repos);

      const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

      const res = result as any;
      const finalEntry = res.students[0].finalGrades.find((f: any) => f.type === 'FINAL');
      expect(finalEntry.condicion).toBeNull();
    });

    it('COND-S10/S11: all 3 condicion values round-trip correctly (REGULAR, PREVIA, LIBRE)', async () => {
      const periods = [makePeriod(1)];
      const makeGrade = (sid: string, condicion: SubjectFinalGradeCondicion | null) =>
        SubjectFinalGrade.reconstruct({
          id: `sfg-${sid}`,
          studentId: sid,
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-uuid-1',
          type: SubjectFinalGradeType.FINAL,
          gradeScaleValueId: null,
          gradeCode: null,
          internalStatus: null,
          passed: false,
          condicion,
        });
      repos = makeRepos({
        sgpRepoResult: periods,
        finalGradeResult: [
          makeGrade('student-1', SubjectFinalGradeCondicion.REGULAR),
          makeGrade('student-2', SubjectFinalGradeCondicion.PREVIA),
          makeGrade('student-3', SubjectFinalGradeCondicion.LIBRE),
          makeGrade('student-4', null),
        ],
        enrolledStudents: [
          { studentId: 'student-1', firstName: 'A', lastName: 'B' },
          { studentId: 'student-2', firstName: 'C', lastName: 'D' },
          { studentId: 'student-3', firstName: 'E', lastName: 'F' },
          { studentId: 'student-4', firstName: 'G', lastName: 'H' },
        ],
      });
      useCase = makeUseCase(repos);

      const result = await useCase.execute({ courseCycleId: 'cc-uuid-1', subjectId: 'subj-uuid-1', ...AUTH });

      const res = result as any;
      const getCondicion = (studentId: string) => {
        const student = res.students.find((s: any) => s.studentId === studentId);
        return student.finalGrades.find((f: any) => f.type === 'FINAL').condicion;
      };
      expect(getCondicion('student-1')).toBe('REGULAR');
      expect(getCondicion('student-2')).toBe('PREVIA');
      expect(getCondicion('student-3')).toBe('LIBRE');
      expect(getCondicion('student-4')).toBeNull();
    });
  });
});
