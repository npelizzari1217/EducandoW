/**
 * PR-1b [RED] — GradingPhaseAuthorizerService unit tests.
 * Implements GradingPhaseAuthorizerPort — decides WHEN a grade write is
 * permitted given the CourseCycle's current gradingPhase (distinct gate
 * from AssignmentAuthorizer, which decides WHO may write).
 *
 * Contract (design #1646):
 *   - CC not found → allowed:true (404 is the calling use-case's job, not this gate's).
 *   - Level does not require a phase (Inicial/Terciario) → allowed:true, reason NOT_APPLICABLE.
 *   - canGradeBimester: delegates to CourseCycle.canGradeBimester(ordinal).
 *   - canGradeFinal: delegates to CourseCycle.canGradeFinal().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GradingPhaseAuthorizerService } from '../grading-phase-authorizer.service';
import { CourseCycle, CourseName, PassingGrade, Level, LevelType, GradingPhase } from '@educandow/domain';

function makeCC(overrides: { level?: LevelType; gradingPhase?: string | null } = {}) {
  const cc = CourseCycle.create({
    courseId: 'course-1',
    studyPlanId: 'plan-1',
    cycleId: 'cycle-1',
    courseName: CourseName.create('MATEMÁTICA').unwrap(),
    level: Level.reconstruct(overrides.level ?? LevelType.PRIMARIO),
    passingGrade: PassingGrade.create(6).unwrap(),
  });
  if (overrides.gradingPhase !== undefined) {
    cc.setGradingPhase(
      overrides.gradingPhase === null ? null : GradingPhase.create(overrides.gradingPhase).unwrap(),
    );
  }
  return cc;
}

function makeCcRepo(cc: CourseCycle | null) {
  return { findByUuid: vi.fn().mockResolvedValue(cc) };
}

describe('GradingPhaseAuthorizerService', () => {
  let ccRepo: ReturnType<typeof makeCcRepo>;

  beforeEach(() => {
    ccRepo = makeCcRepo(null);
  });

  describe('canGradeBimester', () => {
    it('CC not found → allowed:true (existence is the caller use-case 404 gate, not this one)', async () => {
      ccRepo = makeCcRepo(null);
      const svc = new GradingPhaseAuthorizerService(ccRepo as any);

      const decision = await svc.canGradeBimester('nonexistent-cc', 1);

      expect(decision).toEqual({ allowed: true, reason: 'ALLOWED' });
    });

    it('level does not require grading phase (Inicial) → allowed:true, reason NOT_APPLICABLE', async () => {
      ccRepo = makeCcRepo(makeCC({ level: LevelType.INICIAL }));
      const svc = new GradingPhaseAuthorizerService(ccRepo as any);

      const decision = await svc.canGradeBimester('cc-1', 1);

      expect(decision).toEqual({ allowed: true, reason: 'NOT_APPLICABLE' });
    });

    it('phase is null (cutover) → rejects with reason NO_PHASE', async () => {
      ccRepo = makeCcRepo(makeCC({ gradingPhase: null }));
      const svc = new GradingPhaseAuthorizerService(ccRepo as any);

      const decision = await svc.canGradeBimester('cc-1', 1);

      expect(decision).toEqual({ allowed: false, reason: 'NO_PHASE' });
    });

    it('phase BIM_1 allows periodOrdinal 1', async () => {
      ccRepo = makeCcRepo(makeCC({ gradingPhase: 'BIM_1' }));
      const svc = new GradingPhaseAuthorizerService(ccRepo as any);

      const decision = await svc.canGradeBimester('cc-1', 1);

      expect(decision).toEqual({ allowed: true, reason: 'ALLOWED' });
    });

    it('phase BIM_1 rejects periodOrdinal 2 with reason WRONG_BIMESTER', async () => {
      ccRepo = makeCcRepo(makeCC({ gradingPhase: 'BIM_1' }));
      const svc = new GradingPhaseAuthorizerService(ccRepo as any);

      const decision = await svc.canGradeBimester('cc-1', 2);

      expect(decision).toEqual({ allowed: false, reason: 'WRONG_BIMESTER' });
    });

    it('phase CIERRE rejects any bimester with reason IS_CIERRE', async () => {
      ccRepo = makeCcRepo(makeCC({ gradingPhase: 'CIERRE' }));
      const svc = new GradingPhaseAuthorizerService(ccRepo as any);

      const decision = await svc.canGradeBimester('cc-1', 1);

      expect(decision).toEqual({ allowed: false, reason: 'IS_CIERRE' });
    });
  });

  describe('canGradeFinal', () => {
    it('CC not found → allowed:true (caller resolves 404)', async () => {
      ccRepo = makeCcRepo(null);
      const svc = new GradingPhaseAuthorizerService(ccRepo as any);

      const decision = await svc.canGradeFinal('nonexistent-cc');

      expect(decision).toEqual({ allowed: true, reason: 'ALLOWED' });
    });

    it('level does not require grading phase (Terciario) → allowed:true, reason NOT_APPLICABLE', async () => {
      ccRepo = makeCcRepo(makeCC({ level: LevelType.TERCIARIO }));
      const svc = new GradingPhaseAuthorizerService(ccRepo as any);

      const decision = await svc.canGradeFinal('cc-1');

      expect(decision).toEqual({ allowed: true, reason: 'NOT_APPLICABLE' });
    });

    it('phase CIERRE → allowed:true', async () => {
      ccRepo = makeCcRepo(makeCC({ gradingPhase: 'CIERRE' }));
      const svc = new GradingPhaseAuthorizerService(ccRepo as any);

      const decision = await svc.canGradeFinal('cc-1');

      expect(decision).toEqual({ allowed: true, reason: 'ALLOWED' });
    });

    it('active bimester (not CIERRE) → rejects with reason NOT_CIERRE', async () => {
      ccRepo = makeCcRepo(makeCC({ gradingPhase: 'BIM_2' }));
      const svc = new GradingPhaseAuthorizerService(ccRepo as any);

      const decision = await svc.canGradeFinal('cc-1');

      expect(decision).toEqual({ allowed: false, reason: 'NOT_CIERRE' });
    });

    it('phase null (cutover) → rejects with reason NOT_CIERRE', async () => {
      ccRepo = makeCcRepo(makeCC({ gradingPhase: null }));
      const svc = new GradingPhaseAuthorizerService(ccRepo as any);

      const decision = await svc.canGradeFinal('cc-1');

      expect(decision).toEqual({ allowed: false, reason: 'NOT_CIERRE' });
    });
  });
});
