/**
 * PR4-T9 [RED] — UpsertSubjectFinalGradesUseCase tests.
 * Specs: SFG-R3, SFG-R4, SFG-R5, SFG-R6, SFG-R7, SFG-R8, SFG-R9, AD-2
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpsertSubjectFinalGradesUseCase } from './upsert-subject-final-grades.use-case';
import {
  SubjectFinalGrade,
  SubjectFinalGradeType,
  SubjectFinalGradeCondicion,
  NotFoundError,
  ValidationError,
} from '@educandow/domain';
import { TenantContext } from '../../infrastructure/auth/tenant.context';

vi.mock('../../infrastructure/auth/tenant.context', () => ({
  TenantContext: {
    getClient: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const MOCK_GRADE_SCALE_VALUE = {
  id: 'gsv-1',
  scaleId: 'scale-1',
  code: 'A',
  internalStatus: 'APROBADO',
};

const MOCK_GRADE_SCALE = { id: 'scale-1', level: 20, modality: 1 };

function makeExistingFinal(
  type: SubjectFinalGradeType,
  passed: boolean | null = null,
): SubjectFinalGrade {
  const g = SubjectFinalGrade.create({
    studentId: 'student-1',
    courseCycleId: 'cc-uuid-1',
    subjectId: 'subj-1',
    type,
  });
  if (passed !== null) {
    g.setPassed(passed);
  }
  return g;
}

function makeRepos(overrides: Partial<{
  existingFinals: SubjectFinalGrade[];
  gradingCtx: { level: number; modality: number } | null;
  gradeScaleValue: unknown;
  gradeScale: unknown;
  studentExists: boolean;
}> = {}) {
  const existingFinals = overrides.existingFinals ?? [];
  const gradingCtx = overrides.gradingCtx !== undefined ? overrides.gradingCtx : { level: 20, modality: 1 };
  const gradeScaleValue = overrides.gradeScaleValue !== undefined ? overrides.gradeScaleValue : MOCK_GRADE_SCALE_VALUE;
  const gradeScale = overrides.gradeScale !== undefined ? overrides.gradeScale : MOCK_GRADE_SCALE;
  const studentExists = overrides.studentExists !== undefined ? overrides.studentExists : true;

  return {
    finalGradeRepo: {
      findByCourseCycleAndSubject: vi.fn().mockResolvedValue(existingFinals),
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
  };
}

function makeUseCase(repos: ReturnType<typeof makeRepos>) {
  return new UpsertSubjectFinalGradesUseCase(
    repos.finalGradeRepo as any,
    repos.ccRepo as any,
    repos.gradeScaleRepo as any,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UpsertSubjectFinalGradesUseCase
// ═══════════════════════════════════════════════════════════════════════════════

describe('UpsertSubjectFinalGradesUseCase', () => {
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    repos = makeRepos();
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('SFG-R5: valid FINAL upsert succeeds — returns ok(void)', async () => {
    const uc = makeUseCase(repos);
    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.FINAL,
      }],
    });
    expect(result.isOk()).toBe(true);
  });

  it('empty items returns ok(void) without any repo calls', async () => {
    const uc = makeUseCase(repos);
    const result = await uc.execute({ items: [] });
    expect(result.isOk()).toBe(true);
    expect(repos.finalGradeRepo.saveMany).not.toHaveBeenCalled();
  });

  it('SFG-R4: passed field is accepted for all types', async () => {
    for (const type of [
      SubjectFinalGradeType.FINAL,
      SubjectFinalGradeType.DICIEMBRE,
      SubjectFinalGradeType.MARZO,
      SubjectFinalGradeType.DEFINITIVA,
    ]) {
      repos = makeRepos({ existingFinals: [] });
      vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
      const uc = makeUseCase(repos);

      const result = await uc.execute({
        items: [{
          studentId: 'student-1',
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-1',
          type,
          passed: true,
        }],
      });

      expect(result.isOk()).toBe(true);
    }
  });

  it('SFG-R5: assigns grade using gradeScaleValueId — snapshots code + internalStatus', async () => {
    repos = makeRepos({ existingFinals: [] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.FINAL,
        gradeScaleValueId: 'gsv-1',
      }],
    });

    expect(result.isOk()).toBe(true);
    const saved = (repos.finalGradeRepo.saveMany as any).mock.calls[0][0];
    const savedGrade = saved[0];
    expect(savedGrade.gradeScaleValueId).toBe('gsv-1');
    expect(savedGrade.gradeCode).toBe('A');
    expect(savedGrade.internalStatus).toBe('APROBADO');
  });

  it('SFG-R7: upsert semantics — existing FINAL row is updated, not duplicated', async () => {
    const existingFinal = makeExistingFinal(SubjectFinalGradeType.FINAL, false);
    repos = makeRepos({ existingFinals: [existingFinal] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.FINAL,
        passed: true,
      }],
    });

    expect(result.isOk()).toBe(true);
    // Only one row saved (updated, not duplicated)
    const saved = (repos.finalGradeRepo.saveMany as any).mock.calls[0][0];
    expect(saved).toHaveLength(1);
    expect(saved[0].passed).toBe(true);
  });

  // ── Conditional lifecycle (AD-2) ────────────────────────────────────────────

  it('AD-2: DICIEMBRE blocked when FINAL.passed=true → err(ValidationError) [400]', async () => {
    const finalPassed = makeExistingFinal(SubjectFinalGradeType.FINAL, true);
    repos = makeRepos({ existingFinals: [finalPassed] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.DICIEMBRE,
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(repos.finalGradeRepo.saveMany).not.toHaveBeenCalled();
  });

  it('AD-2: DICIEMBRE allowed when FINAL.passed=false', async () => {
    const finalNotPassed = makeExistingFinal(SubjectFinalGradeType.FINAL, false);
    repos = makeRepos({ existingFinals: [finalNotPassed] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.DICIEMBRE,
      }],
    });

    expect(result.isOk()).toBe(true);
  });

  it('AD-2: DICIEMBRE allowed when no FINAL row exists yet', async () => {
    repos = makeRepos({ existingFinals: [] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.DICIEMBRE,
      }],
    });

    expect(result.isOk()).toBe(true);
  });

  it('AD-2: MARZO blocked when DICIEMBRE.passed=true → err(ValidationError) [400]', async () => {
    const diciembrePassed = makeExistingFinal(SubjectFinalGradeType.DICIEMBRE, true);
    repos = makeRepos({ existingFinals: [diciembrePassed] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.MARZO,
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  it('AD-2: MARZO allowed when DICIEMBRE.passed=false', async () => {
    const diciembreNotPassed = makeExistingFinal(SubjectFinalGradeType.DICIEMBRE, false);
    repos = makeRepos({ existingFinals: [diciembreNotPassed] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.MARZO,
      }],
    });

    expect(result.isOk()).toBe(true);
  });

  it('AD-2: DEFINITIVA has no lifecycle block — always allowed', async () => {
    // Even if FINAL.passed=true, DEFINITIVA is still allowed
    const finalPassed = makeExistingFinal(SubjectFinalGradeType.FINAL, true);
    const diciembrePassed = makeExistingFinal(SubjectFinalGradeType.DICIEMBRE, true);
    repos = makeRepos({ existingFinals: [finalPassed, diciembrePassed] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.DEFINITIVA,
      }],
    });

    expect(result.isOk()).toBe(true);
  });

  // ── Error: invalid gradeScaleValueId → 400 ─────────────────────────────────

  it('SFG-R6: invalid gradeScaleValueId (not found) → err(ValidationError) [400]', async () => {
    repos = makeRepos({ gradeScaleValue: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.FINAL,
        gradeScaleValueId: 'bad-gsv',
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  it('SFG-R6: gradeScaleValueId from wrong scale (level/modality mismatch) → err(ValidationError) [400]', async () => {
    const correctScale = { id: 'scale-1', level: 20, modality: 1 };
    const valueForWrongScale = { id: 'gsv-wrong', scaleId: 'scale-OTHER', code: 'B', internalStatus: 'NO_APROBADO' };
    repos = makeRepos({ gradeScale: correctScale, gradeScaleValue: valueForWrongScale });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.FINAL,
        gradeScaleValueId: 'gsv-wrong',
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  // ── Error: missing refs → 404 ───────────────────────────────────────────────

  it('SFG-R7: missing courseCycleId → err(NotFoundError) [404]', async () => {
    repos = makeRepos({ gradingCtx: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-1',
        courseCycleId: 'nonexistent-cc',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.FINAL,
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  it('missing studentId → err(NotFoundError) [404]', async () => {
    repos = makeRepos({ studentExists: false });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'nonexistent-student',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.FINAL,
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  // ── Cross-tenant → 404 ──────────────────────────────────────────────────────

  it('cross-tenant courseCycleId → err(NotFoundError) [404] — no data leak', async () => {
    repos = makeRepos({ gradingCtx: null });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [{
        studentId: 'student-x',
        courseCycleId: 'other-tenant-cc',
        subjectId: 'subj-x',
        type: SubjectFinalGradeType.FINAL,
      }],
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(NotFoundError);
  });

  // ── condicion validation (PR4-T1 [RED]) ─────────────────────────────────────

  describe('condicion validation', () => {
    it('C-1: LIBRE + passed=true → err(ValidationError) [400] — written against USE CASE (would false-green against entity alone)', async () => {
      repos = makeRepos({ existingFinals: [] });
      vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
      const uc = makeUseCase(repos);

      const result = await uc.execute({
        items: [{
          studentId: 'student-1',
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-1',
          type: SubjectFinalGradeType.FINAL,
          passed: true,
          condicion: SubjectFinalGradeCondicion.LIBRE,
        }],
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
      expect(repos.finalGradeRepo.saveMany).not.toHaveBeenCalled();
    });

    it('C-2: PREVIA + passed=true → err(ValidationError) [400] — written against USE CASE (would false-green against entity alone)', async () => {
      repos = makeRepos({ existingFinals: [] });
      vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
      const uc = makeUseCase(repos);

      const result = await uc.execute({
        items: [{
          studentId: 'student-1',
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-1',
          type: SubjectFinalGradeType.FINAL,
          passed: true,
          condicion: SubjectFinalGradeCondicion.PREVIA,
        }],
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
      expect(repos.finalGradeRepo.saveMany).not.toHaveBeenCalled();
    });

    it('C-1 cross-field: existing passed=true + new condicion=LIBRE → err(ValidationError) [400]', async () => {
      // Validates combined state: existing row already has passed=true; item sets condicion only
      const existingGrade = SubjectFinalGrade.reconstruct({
        id: 'sfg-1',
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.FINAL,
        gradeScaleValueId: null,
        gradeCode: null,
        internalStatus: null,
        passed: true,
        condicion: null,
      });
      repos = makeRepos({ existingFinals: [existingGrade] });
      vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
      const uc = makeUseCase(repos);

      const result = await uc.execute({
        items: [{
          studentId: 'student-1',
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-1',
          type: SubjectFinalGradeType.FINAL,
          condicion: SubjectFinalGradeCondicion.LIBRE,
          // passed NOT provided — existing passed=true still applies
        }],
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    });

    it('condicion=REGULAR applied and saved correctly (verifies setCondicion is called)', async () => {
      repos = makeRepos({ existingFinals: [] });
      vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
      const uc = makeUseCase(repos);

      const result = await uc.execute({
        items: [{
          studentId: 'student-1',
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-1',
          type: SubjectFinalGradeType.FINAL,
          passed: false,
          condicion: SubjectFinalGradeCondicion.REGULAR,
        }],
      });

      expect(result.isOk()).toBe(true);
      const saved = (repos.finalGradeRepo.saveMany as any).mock.calls[0][0];
      expect(saved[0].condicion).toBe(SubjectFinalGradeCondicion.REGULAR);
    });

    it('C-3: REGULAR + passed=true → ok', async () => {
      repos = makeRepos({ existingFinals: [] });
      vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
      const uc = makeUseCase(repos);

      const result = await uc.execute({
        items: [{
          studentId: 'student-1',
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-1',
          type: SubjectFinalGradeType.FINAL,
          passed: true,
          condicion: SubjectFinalGradeCondicion.REGULAR,
        }],
      });

      expect(result.isOk()).toBe(true);
    });

    it('C-3: REGULAR + passed=false → ok', async () => {
      repos = makeRepos({ existingFinals: [] });
      vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
      const uc = makeUseCase(repos);

      const result = await uc.execute({
        items: [{
          studentId: 'student-1',
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-1',
          type: SubjectFinalGradeType.FINAL,
          passed: false,
          condicion: SubjectFinalGradeCondicion.REGULAR,
        }],
      });

      expect(result.isOk()).toBe(true);
    });

    it('PREVIA + passed=false → ok', async () => {
      repos = makeRepos({ existingFinals: [] });
      vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
      const uc = makeUseCase(repos);

      const result = await uc.execute({
        items: [{
          studentId: 'student-1',
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-1',
          type: SubjectFinalGradeType.FINAL,
          passed: false,
          condicion: SubjectFinalGradeCondicion.PREVIA,
        }],
      });

      expect(result.isOk()).toBe(true);
    });

    it('LIBRE + passed=false → ok', async () => {
      repos = makeRepos({ existingFinals: [] });
      vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
      const uc = makeUseCase(repos);

      const result = await uc.execute({
        items: [{
          studentId: 'student-1',
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-1',
          type: SubjectFinalGradeType.FINAL,
          passed: false,
          condicion: SubjectFinalGradeCondicion.LIBRE,
        }],
      });

      expect(result.isOk()).toBe(true);
    });

    it('condicion=undefined leaves existing condicion unchanged (COND-R2/COND-S5)', async () => {
      const existingGrade = SubjectFinalGrade.reconstruct({
        id: 'sfg-1',
        studentId: 'student-1',
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-1',
        type: SubjectFinalGradeType.FINAL,
        gradeScaleValueId: null,
        gradeCode: null,
        internalStatus: null,
        passed: false,
        condicion: SubjectFinalGradeCondicion.PREVIA,
      });
      repos = makeRepos({ existingFinals: [existingGrade] });
      vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
      const uc = makeUseCase(repos);

      const result = await uc.execute({
        items: [{
          studentId: 'student-1',
          courseCycleId: 'cc-uuid-1',
          subjectId: 'subj-1',
          type: SubjectFinalGradeType.FINAL,
          // condicion NOT provided — existing PREVIA should be preserved
        }],
      });

      expect(result.isOk()).toBe(true);
      const saved = (repos.finalGradeRepo.saveMany as any).mock.calls[0][0];
      expect(saved[0].condicion).toBe(SubjectFinalGradeCondicion.PREVIA);
    });
  });

  // ── Batch: multiple items saved together ────────────────────────────────────

  it('batch with multiple types for same student calls saveMany with all rows', async () => {
    repos = makeRepos({ existingFinals: [] });
    vi.mocked(TenantContext.getClient).mockReturnValue(repos.mockClient as any);
    const uc = makeUseCase(repos);

    const result = await uc.execute({
      items: [
        { studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-1', type: SubjectFinalGradeType.FINAL },
        { studentId: 'student-1', courseCycleId: 'cc-uuid-1', subjectId: 'subj-1', type: SubjectFinalGradeType.DICIEMBRE },
      ],
    });

    expect(result.isOk()).toBe(true);
    const saved = (repos.finalGradeRepo.saveMany as any).mock.calls[0][0];
    expect(saved).toHaveLength(2);
  });
});
