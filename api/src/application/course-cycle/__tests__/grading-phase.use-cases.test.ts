/**
 * PR-1b [RED] — Get/SetGradingPhaseUseCase tests.
 * Specs: AC-A-1..14 (spec #1645), design #1646.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetGradingPhaseUseCase, SetGradingPhaseUseCase } from '../use-cases/grading-phase.use-cases';
import {
  CourseCycle,
  CourseName,
  PassingGrade,
  Level,
  LevelType,
  GradingPhase,
  CourseCycleNotFoundError,
  GradingPhaseNotApplicableError,
  ValidationError,
} from '@educandow/domain';

function makeCC(level: LevelType = LevelType.PRIMARIO) {
  return CourseCycle.create({
    courseId: 'course-1',
    studyPlanId: 'plan-1',
    cycleId: 'cycle-1',
    courseName: CourseName.create('MATEMÁTICA').unwrap(),
    level: Level.reconstruct(level),
    passingGrade: PassingGrade.create(6).unwrap(),
  });
}

function makeCcRepo(cc: CourseCycle | null) {
  return {
    findByUuid: vi.fn().mockResolvedValue(cc),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

describe('GetGradingPhaseUseCase', () => {
  it('returns null when the CourseCycle has no active phase', async () => {
    const ccRepo = makeCcRepo(makeCC());
    const uc = new GetGradingPhaseUseCase(ccRepo as any);

    const result = await uc.execute('cc-uuid-1');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ gradingPhase: null });
  });

  it('returns the active phase code', async () => {
    const cc = makeCC();
    cc.setGradingPhase(GradingPhase.create('BIM_2').unwrap());
    const ccRepo = makeCcRepo(cc);
    const uc = new GetGradingPhaseUseCase(ccRepo as any);

    const result = await uc.execute('cc-uuid-1');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ gradingPhase: 'BIM_2' });
  });

  it('returns CourseCycleNotFoundError when CC does not exist', async () => {
    const ccRepo = makeCcRepo(null);
    const uc = new GetGradingPhaseUseCase(ccRepo as any);

    const result = await uc.execute('nonexistent');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(CourseCycleNotFoundError);
  });
});

describe('SetGradingPhaseUseCase', () => {
  let ccRepo: ReturnType<typeof makeCcRepo>;

  beforeEach(() => {
    ccRepo = makeCcRepo(makeCC());
  });

  it('sets a bimester phase and persists via save', async () => {
    const uc = new SetGradingPhaseUseCase(ccRepo as any);

    const result = await uc.execute('cc-uuid-1', { gradingPhase: 'BIM_1' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ gradingPhase: 'BIM_1' });
    expect(ccRepo.save).toHaveBeenCalledTimes(1);
  });

  it('sets CIERRE', async () => {
    const uc = new SetGradingPhaseUseCase(ccRepo as any);

    const result = await uc.execute('cc-uuid-1', { gradingPhase: 'CIERRE' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ gradingPhase: 'CIERRE' });
  });

  it('clears the phase back to null — reversible (CIERRE → bimestre / null)', async () => {
    const uc = new SetGradingPhaseUseCase(ccRepo as any);

    const result = await uc.execute('cc-uuid-1', { gradingPhase: null });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ gradingPhase: null });
    expect(ccRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid phase code with ValidationError', async () => {
    const uc = new SetGradingPhaseUseCase(ccRepo as any);

    const result = await uc.execute('cc-uuid-1', { gradingPhase: 'INVALID' as any });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    expect(ccRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the CourseCycle level does not support grading phases (Inicial) → 422', async () => {
    ccRepo = makeCcRepo(makeCC(LevelType.INICIAL));
    const uc = new SetGradingPhaseUseCase(ccRepo as any);

    const result = await uc.execute('cc-uuid-1', { gradingPhase: 'BIM_1' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(GradingPhaseNotApplicableError);
    expect(ccRepo.save).not.toHaveBeenCalled();
  });

  it('rejects when the CourseCycle level does not support grading phases (Terciario) → 422', async () => {
    ccRepo = makeCcRepo(makeCC(LevelType.TERCIARIO));
    const uc = new SetGradingPhaseUseCase(ccRepo as any);

    const result = await uc.execute('cc-uuid-1', { gradingPhase: null });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(GradingPhaseNotApplicableError);
  });

  it('returns CourseCycleNotFoundError when CC does not exist', async () => {
    ccRepo = makeCcRepo(null);
    const uc = new SetGradingPhaseUseCase(ccRepo as any);

    const result = await uc.execute('nonexistent', { gradingPhase: 'BIM_1' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(CourseCycleNotFoundError);
  });
});
