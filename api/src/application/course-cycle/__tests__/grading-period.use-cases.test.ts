/**
 * SetActivePeriodUseCase — unit tests (T43, SDD-2 PR-6)
 * Verifies that SetActivePeriodUseCase:
 *   - saves the CourseCycle with the new grading period
 *   - does NOT touch any Enrollment (D12 deletion gate)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetActivePeriodUseCase } from '../use-cases/grading-period.use-cases';

// ── fake repos ──────────────────────────────────────────────────────────────

function makeCourseCycleRepo() {
  return {
    findByUuid: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    findByFilters: vi.fn(),
    findById: vi.fn(),
    softDelete: vi.fn(),
    existsByCourseCycleId: vi.fn(),
    findAll: vi.fn(),
    findByStudyPlan: vi.fn(),
    bulkCreate: vi.fn(),
  };
}

/** Returns a minimal CourseCycle-shaped object. The use-case only calls
 *  cc.setActiveGradingPeriod() and reads cc.cycleId — so we fake those. */
function makeCourseCycle() {
  const state = { activeGradingPeriod: null as number | null };
  return {
    uuid: 'cc-uuid-1',
    cycleId: 'cycle-1',
    setActiveGradingPeriod: (v: number | null) => { state.activeGradingPeriod = v; },
    get activeGradingPeriod() { return state.activeGradingPeriod; },
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('SetActivePeriodUseCase (T43 — no Enrollment writes)', () => {
  let ccRepo: ReturnType<typeof makeCourseCycleRepo>;
  let useCase: SetActivePeriodUseCase;

  beforeEach(() => {
    ccRepo = makeCourseCycleRepo();
    // SetActivePeriodUseCase should only receive courseCycleRepo (no enrollmentRepo)
    useCase = new SetActivePeriodUseCase(ccRepo as any);
    ccRepo.findByUuid.mockResolvedValue(makeCourseCycle());
  });

  it('saves the CourseCycle with the explicit grading period', async () => {
    const result = await useCase.execute('cc-uuid-1', { activeGradingPeriod: 2 });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().activeGradingPeriod).toBe(2);
    expect(result.unwrap().source).toBe('explicit');
    expect(ccRepo.save).toHaveBeenCalledTimes(1);
  });

  it('saves the CourseCycle with null (clears explicit grading period)', async () => {
    const result = await useCase.execute('cc-uuid-1', { activeGradingPeriod: null });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().source).toBe('none');
    expect(ccRepo.save).toHaveBeenCalledTimes(1);
  });

  it('returns CourseCycleNotFoundError when CC does not exist', async () => {
    ccRepo.findByUuid.mockResolvedValue(null);

    const result = await useCase.execute('nonexistent', { activeGradingPeriod: 1 });

    expect(result.isErr()).toBe(true);
    expect(ccRepo.save).not.toHaveBeenCalled();
  });

  it('[D12] does NOT call any enrollment repository method', async () => {
    // The use-case constructor must NOT accept an enrollmentRepo.
    // This test verifies it by checking that only 1 arg is required and the use-case
    // is instantiated with only courseCycleRepo — if it still needed enrollmentRepo,
    // this constructor call would fail at runtime or TS type-check.
    const noEnrollmentRepo = new SetActivePeriodUseCase(ccRepo as any);
    const result = await noEnrollmentRepo.execute('cc-uuid-1', { activeGradingPeriod: 3 });

    expect(result.isOk()).toBe(true);
    // ccRepo.save was called (CourseCycle write) — Enrollment.save was NOT (no enrollmentRepo at all)
    expect(ccRepo.save).toHaveBeenCalledTimes(1);
  });
});
