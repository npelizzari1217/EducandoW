import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { PedagogyController } from '../pedagogy.controller';
import { StudyPlanHasDependenciesError } from '@educandow/domain';
import { err, ok } from '@educandow/domain';

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
