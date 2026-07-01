/**
 * GradingPhaseAuthorizerService — application service (fase-bimestre-cierre-asistencia, PR-1b).
 *
 * Implements GradingPhaseAuthorizerPort. Decides WHEN a grade write is permitted
 * given the CourseCycle's current gradingPhase — distinct from AssignmentAuthorizer
 * (which decides WHO may write). The two gates are independent and run in sequence
 * inside the upsert use cases (design #1646).
 *
 * Contract:
 *   - CourseCycle not found → allowed:true. This gate never surfaces a 404; the
 *     calling use case already validates CC existence via its own repo call.
 *   - Level that doesn't require a grading phase (Inicial/Terciario) → allowed:true,
 *     reason NOT_APPLICABLE.
 *   - Otherwise delegates to CourseCycle.canGradeBimester(ordinal) / canGradeFinal().
 */
import { Injectable } from '@nestjs/common';
import type { CourseCycleRepository, GradingPhaseAuthorizerPort, PhaseDecision } from '@educandow/domain';

@Injectable()
export class GradingPhaseAuthorizerService implements GradingPhaseAuthorizerPort {
  constructor(private readonly ccRepo: CourseCycleRepository) {}

  async canGradeBimester(courseCycleId: string, periodOrdinal: number): Promise<PhaseDecision> {
    const cc = await this.ccRepo.findByUuid(courseCycleId);
    if (!cc) return { allowed: true, reason: 'ALLOWED' };
    if (!cc.requiresGradingPhase()) return { allowed: true, reason: 'NOT_APPLICABLE' };

    if (cc.canGradeBimester(periodOrdinal)) {
      return { allowed: true, reason: 'ALLOWED' };
    }

    const phase = cc.gradingPhase;
    if (!phase) return { allowed: false, reason: 'NO_PHASE' };
    if (phase.isCierre()) return { allowed: false, reason: 'IS_CIERRE' };
    return { allowed: false, reason: 'WRONG_BIMESTER' };
  }

  async canGradeFinal(courseCycleId: string): Promise<PhaseDecision> {
    const cc = await this.ccRepo.findByUuid(courseCycleId);
    if (!cc) return { allowed: true, reason: 'ALLOWED' };
    if (!cc.requiresGradingPhase()) return { allowed: true, reason: 'NOT_APPLICABLE' };

    if (cc.canGradeFinal()) {
      return { allowed: true, reason: 'ALLOWED' };
    }
    return { allowed: false, reason: 'NOT_CIERRE' };
  }
}
