/**
 * CourseCycleController — GET/PATCH :uuid/grading-phase tests (PR-1b).
 * AC-A-1/2 (rank gate) is covered generically by RankGuard's own test suite
 * (rank.guard.test.ts); this file verifies:
 *   - the @Rank(40) metadata is actually applied to the PATCH handler,
 *   - the controller methods delegate correctly to the use cases and map
 *     Result errors to thrown domain errors (resolved to HTTP by the filter).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ok, err, CourseCycleNotFoundError, GradingPhaseNotApplicableError } from '@educandow/domain';
import { RANK_KEY } from '../../../infrastructure/auth/decorators/rank.decorator';

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
  ctrl.listUC = overrides.listUC ?? { execute: vi.fn() };
  ctrl.generateUC = overrides.generateUC ?? { execute: vi.fn() };
  ctrl.getGradingPeriodUC = overrides.getGradingPeriodUC ?? { execute: vi.fn() };
  ctrl.setGradingPeriodUC = overrides.setGradingPeriodUC ?? { execute: vi.fn() };
  ctrl.listStudentsUC = overrides.listStudentsUC ?? { execute: vi.fn() };
  ctrl.listTeacherCCsUC = overrides.listTeacherCCsUC ?? { execute: vi.fn() };
  ctrl.listTeacherSubjectsUC = overrides.listTeacherSubjectsUC ?? { execute: vi.fn() };
  ctrl.listAdminSubjectsUC = overrides.listAdminSubjectsUC ?? { execute: vi.fn() };
  ctrl.getGradingPhaseUC = overrides.getGradingPhaseUC ?? { execute: vi.fn() };
  ctrl.setGradingPhaseUC = overrides.setGradingPhaseUC ?? { execute: vi.fn() };
  return ctrl;
}

describe('CourseCycleController — GET :uuid/grading-phase', () => {
  it('returns the current phase from GetGradingPhaseUseCase', async () => {
    const getMock = vi.fn().mockResolvedValue(ok({ gradingPhase: 'BIM_1' }));
    const ctrl = makeController({ getGradingPhaseUC: { execute: getMock } });

    const result = await ctrl.getGradingPhase('cc-uuid-1');

    expect(getMock).toHaveBeenCalledWith('cc-uuid-1');
    expect(result).toEqual({ data: { gradingPhase: 'BIM_1' } });
  });

  it('propagates CourseCycleNotFoundError as a thrown error (→ 404 via filter)', async () => {
    const getMock = vi.fn().mockResolvedValue(err(new CourseCycleNotFoundError('nonexistent')));
    const ctrl = makeController({ getGradingPhaseUC: { execute: getMock } });

    await expect(ctrl.getGradingPhase('nonexistent')).rejects.toBeInstanceOf(CourseCycleNotFoundError);
  });
});

describe('CourseCycleController — PATCH :uuid/grading-phase', () => {
  it('@Rank(40) metadata is applied to the handler (Secretario+ gate, AC-A-1/2)', () => {
    const reflector = new Reflector();
    const rank = reflector.get<number>(RANK_KEY, CourseCycleController.prototype.setGradingPhase);
    expect(rank).toBe(40);
  });

  it('delegates to SetGradingPhaseUseCase and returns the new value', async () => {
    const setMock = vi.fn().mockResolvedValue(ok({ gradingPhase: 'CIERRE' }));
    const ctrl = makeController({ setGradingPhaseUC: { execute: setMock } });

    const result = await ctrl.setGradingPhase('cc-uuid-1', { gradingPhase: 'CIERRE' });

    expect(setMock).toHaveBeenCalledWith('cc-uuid-1', { gradingPhase: 'CIERRE' });
    expect(result).toEqual({ data: { gradingPhase: 'CIERRE' } });
  });

  it('propagates GradingPhaseNotApplicableError as a thrown error (→ 422 via filter, Inicial/Terciario)', async () => {
    const setMock = vi.fn().mockResolvedValue(err(new GradingPhaseNotApplicableError('cc-uuid-1')));
    const ctrl = makeController({ setGradingPhaseUC: { execute: setMock } });

    await expect(
      ctrl.setGradingPhase('cc-uuid-1', { gradingPhase: 'BIM_1' }),
    ).rejects.toBeInstanceOf(GradingPhaseNotApplicableError);
  });
});
