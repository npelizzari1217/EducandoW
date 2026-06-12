/**
 * PR4-T7 [RED] — UpsertSubjectPeriodGradesUseCase tests.
 * Specs: SPG-R3, SPG-R4, SPG-R5, SPG-R6, SPG-R7, SPG-R9, PPF-R2, PPF-R4, PPF-R7, PPF-R8, PPF-R9, PPF-R11, AD-3
 * Fase 5 additions: F5-T1 (docente no asignado → 403), F5-T4 (asignado → 200)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpsertSubjectPeriodGradesUseCase } from './upsert-subject-period-grades.use-case';
import { SubjectPeriodGrade, SubjectGradingPeriod, NotFoundError, ValidationError, ForbiddenError } from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

vi.mock('../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePeriod(ordinal: number): SubjectGradingPeriod {
  return SubjectGradingPeriod.snapshotFromTemplateItem({
    courseCycleId: 'cc-uuid-1',
    subjectId: 'subj-1',
    sortOrder: ordinal,
    name: `Período ${ordinal}`,
  });
}

const MOCK_GRADE_SCALE_VALUE = {
  id: 'gsv-1',
  scaleId: 'scale-1',
  code: 'A',
  internalStatus: 'APROBADO',
};

const MOCK_GRADE_SCALE = {
  id: 'scale-1',
  level: 20,
  modality: 1,
};

function makeRepos(overrides: Partial<{
  sgpPeriods: SubjectGradingPeriod[];
  existingGrades: SubjectPeriodGrade[];
  gradingCtx: { level: number; modality: number } | null;
  gradeScaleValue: unknown;
  gradeScale: unknown;
  studentExists: boolean;
  /** Authorizer result — defaults to true (user is authorized). */
  authorized: boolean;
}> = {}) {
  const periods = overrides.sgpPeriods ?? [makePeriod(1), makePeriod(2), makePeriod(3)];
  const existingGrades = overrides.existingGrades ?? [];
  const gradingCtx = overrides.gradingCtx !== undefined ? overrides.gradingCtx : { level: 20, modality: 1 };
  const gradeScaleValue = overrides.gradeScaleValue !== undefined ? overrides.gradeScaleValue : MOCK_GRADE_SCALE_VALUE;
  const gradeScale = overrides.gradeScale !== undefined ? overrides.gradeScale : MOCK_GRADE_SCALE;
  const studentExists = overrides.studentExists !== undefined ? overrides.studentExists : true;
  const authorized = overrides.authorized !== undefined ? overrides.authorized : true;

  return {
    sgpRepo: {
      findByCourseCycleAndSubject: vi.fn().mockResolvedValue(periods),
      ensureSnapshot: vi.fn().mockResolvedValue(periods),
      save: vi.fn().mockResolvedValue(undefined),
    },
    periodGradeRepo: {
      findByCourseCycleAndSubject: vi.fn().mockResolvedValue(existingGrades),
      saveMany: vi.fn().mockResolvedValue(undefined),
    },
    ccRepo: {
      findGradingContextByUuid: vi.fn().mockResolvedValue(gradingCtx),
    },
    gradeScaleRepo: {
      findValueById: vi.fn().mockResolvedValue(gradeScaleValue),
      findActiveByLevelModality: vi.fn().mockResolvedValue(gradeScale),
    },
    mockClient: {
      student: {
        findUnique: vi.fn().mockResolvedValue(studentExists ? { id: 'student-1' } : null),
      },
    },
    authorizer: {
      canWriteGrades: vi.fn().mockResolvedValue(authorized),
    },
  };
}

function makeUseCase(repos: ReturnType<typeof makeRepos>) {
  return new UpsertSubjectPeriodGradesUseCase(
    repos.periodGradeRepo as any,
    repos.sgpRepo as any,
    repos.ccRepo as any,
    repos.gradeScaleRepo as any,
    repos.authorizer as any,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UpsertSubjectPeriodGradesUseCase
// ═══════════════════════════════════════════════════════════════════════════════

describe('UpsertSubjectPeriodGradesUseCase', () => {
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('SPG-R3: valid batch upsert succeeds — returns ok(void)', async () => {
    const uc = makeUseCase(repos);
    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        periodOrdinal: 1,
      }],
    });
    expect(result.isOk()).toBe(true);
  });

  it('empty items array returns ok(void) without any repo calls', async () => {
    const uc = makeUseCase(repos);
    const result = await uc.execute({ items: [] });
    expect(result.isOk()).toBe(true);
    expect(repos.periodGradeRepo.saveMany).not.toHaveBeenCalled();
  });

  it('SPG-R4: creates new SubjectPeriodGrade row when no existing grade for (student, period)', async () => {
    repos = makeRepos({ existingGrades: [] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        periodOrdinal: 1,
      }],
    });

    expect(result.isOk()).toBe(true);
    expect(repos.periodGradeRepo.saveMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ studentId: 'student-1', periodOrdinal: 1 }),
      ]),
    );
  });

  it('PPF-R4: pa/ppi/pp flags update independently — omitted fields retain prior value', async () => {
    const existingGrade = SubjectPeriodGrade.reconstruct({
      id: 'spg-1',
      studentId: 'student-1',
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subj-1',
      periodOrdinal: 1,
      gradeScaleValueId: null,
      gradeCode: null,
      internalStatus: null,
      pa: true,
      ppi: false,
      pp: true,
    });
    repos = makeRepos({ existingGrades: [existingGrade] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    // Only set ppi — pa and pp should retain their prior values
    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        periodOrdinal: 1,
        ppi: true,
      }],
    });

    expect(result.isOk()).toBe(true);
    const saved = (repos.periodGradeRepo.saveMany as any).mock.calls[0][0];
    const savedGrade = saved[0];
    expect(savedGrade.pa).toBe(true);   // retained
    expect(savedGrade.ppi).toBe(true);  // updated
    expect(savedGrade.pp).toBe(true);   // retained
  });

  it('SPG-R9: assigns grade using gradeScaleValueId — snapshots code + internalStatus', async () => {
    repos = makeRepos({ existingGrades: [] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        periodOrdinal: 1,
        gradeScaleValueId: 'gsv-1',
      }],
    });

    expect(result.isOk()).toBe(true);
    const saved = (repos.periodGradeRepo.saveMany as any).mock.calls[0][0];
    const savedGrade = saved[0];
    expect(savedGrade.gradeScaleValueId).toBe('gsv-1');
    expect(savedGrade.gradeCode).toBe('A');
    expect(savedGrade.internalStatus).toBe('APROBADO');
  });

  // ── Error: invalid gradeScaleValueId → 400 ─────────────────────────────────

  it('SPG-R5: invalid gradeScaleValueId (value not found) → err(ValidationError) [400]', async () => {
    repos = makeRepos({ gradeScaleValue: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        periodOrdinal: 1,
        gradeScaleValueId: 'nonexistent-gsv',
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(repos.periodGradeRepo.saveMany).not.toHaveBeenCalled();
  });

  it('SPG-R5: gradeScaleValueId belongs to wrong scale (wrong level/modality) → err(ValidationError) [400]', async () => {
    // correctScale.id='scale-1'; value has scaleId='scale-OTHER' → mismatch → 400
    const valueForWrongScale = { id: 'gsv-1', scaleId: 'scale-OTHER', code: 'A', internalStatus: 'APROBADO' };
    const correctScale = { id: 'scale-1', level: 20, modality: 1 };
    repos = makeRepos({ gradeScale: correctScale, gradeScaleValue: valueForWrongScale });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        periodOrdinal: 1,
        gradeScaleValueId: 'gsv-1',
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  // ── Error: missing refs → 404 ───────────────────────────────────────────────

  it('SPG-R7: missing courseCycleId (not found in tenant) → err(NotFoundError) [404]', async () => {
    repos = makeRepos({ gradingCtx: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'nonexistent-cc',
        subjectId: 'subj-1',
        periodOrdinal: 1,
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  it('SPG-R7: missing subjectId (no snapshot periods for CC+subject) → err(NotFoundError) [404]', async () => {
    repos = makeRepos({ sgpPeriods: [] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'nonexistent-subj',
        periodOrdinal: 1,
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  it('missing studentId (student not in tenant) → err(NotFoundError) [404]', async () => {
    repos = makeRepos({ studentExists: false });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'nonexistent-student',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        periodOrdinal: 1,
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  // ── Error: periodOrdinal outside snapshotted range → 400 ───────────────────

  it('SPG-R6: periodOrdinal outside snapshotted range → err(ValidationError) [400]', async () => {
    repos = makeRepos({ sgpPeriods: [makePeriod(1), makePeriod(2)] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        periodOrdinal: 99, // not in snapshot
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(repos.periodGradeRepo.saveMany).not.toHaveBeenCalled();
  });

  // ── Cross-tenant → 404 ──────────────────────────────────────────────────────

  it('cross-tenant courseCycleId returns err(NotFoundError) [404] — no data leak', async () => {
    repos = makeRepos({ gradingCtx: null }); // CC not found in this tenant
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-x',
        courseCycleId: 'other-tenant-cc',
        subjectId: 'subj-x',
        periodOrdinal: 1,
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  // ── Batch: multiple items saved together ────────────────────────────────────

  it('batch with multiple students × periods calls saveMany once with all rows', async () => {
    repos = makeRepos({ existingGrades: [] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [
        { studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-1', periodOrdinal: 1 },
        { studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-1', periodOrdinal: 2 },
        { studentId: 'student-2', courseCycleId: 'cc-uuid-1', subjectId: 'subj-1', periodOrdinal: 1 },
      ],
    });

    expect(result.isOk()).toBe(true);
    const saved = (repos.periodGradeRepo.saveMany as any).mock.calls[0][0];
    expect(saved).toHaveLength(3);
  });

  // ── Fase 5: authorization checks ───────────────────────────────────────────

  it('F5-T1: unassigned teacher → err(ForbiddenError), no saveMany called', async () => {
    repos = makeRepos({ authorized: false });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      userId: 'teacher-unassigned',
      userRoles: ['TEACHER'],
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        periodOrdinal: 1,
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ForbiddenError);
    expect(repos.periodGradeRepo.saveMany).not.toHaveBeenCalled();
  });

  it('F5-T4: assigned teacher → ok(void), grade persisted', async () => {
    repos = makeRepos({ authorized: true });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      userId: 'teacher-assigned',
      userRoles: ['TEACHER'],
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        periodOrdinal: 1,
      }],
    });

    expect(result.isOk()).toBe(true);
    expect(repos.periodGradeRepo.saveMany).toHaveBeenCalled();
    expect(repos.authorizer.canWriteGrades).toHaveBeenCalledWith(
      'teacher-assigned',
      ['TEACHER'],
      'cc-uuid-1',
      'subj-1',
    );
  });

  it('F5: auth check per unique (ccId, subjectId) group — checked once per group', async () => {
    repos = makeRepos({ authorized: true });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    await uc.execute({
      userId: 'teacher-1',
      userRoles: ['TEACHER'],
      items: [
        { studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-1', periodOrdinal: 1 },
        { studentId: 'student-2', courseCycleId: 'cc-uuid-1', subjectId: 'subj-1', periodOrdinal: 1 },
      ],
    });

    // Called once for the single (cc, subject) group
    expect(repos.authorizer.canWriteGrades).toHaveBeenCalledTimes(1);
  });
});
