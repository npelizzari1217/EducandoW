/**
 * Get/SetGradingPhaseUseCase — fase-bimestre-cierre-asistencia, PR-1b.
 * Mirrors the GetActivePeriodUseCase/SetActivePeriodUseCase pattern for the
 * new gradingPhase concept (design #1646, section A2).
 */
import { Injectable } from '@nestjs/common';
import {
  Result, ok, err,
  CourseCycleRepository,
  CourseCycleNotFoundError,
  GradingPhaseNotApplicableError,
  GradingPhase,
} from '@educandow/domain';
import type { GradingPhaseCode } from '@educandow/domain';

// ── Types ──────────────────────────────────────────────────

export interface GradingPhaseResult {
  gradingPhase: GradingPhaseCode | null;
}

export interface SetGradingPhaseInput {
  gradingPhase: GradingPhaseCode | null;
}

// ── Use Cases ──────────────────────────────────────────────

@Injectable()
export class GetGradingPhaseUseCase {
  constructor(private readonly courseCycleRepo: CourseCycleRepository) {}

  async execute(uuid: string): Promise<Result<GradingPhaseResult, Error>> {
    const cc = await this.courseCycleRepo.findByUuid(uuid);
    if (!cc) {
      return err(new CourseCycleNotFoundError(uuid));
    }

    return ok({ gradingPhase: cc.gradingPhase?.code ?? null });
  }
}

@Injectable()
export class SetGradingPhaseUseCase {
  constructor(private readonly courseCycleRepo: CourseCycleRepository) {}

  async execute(
    uuid: string,
    input: SetGradingPhaseInput,
  ): Promise<Result<GradingPhaseResult, Error>> {
    const cc = await this.courseCycleRepo.findByUuid(uuid);
    if (!cc) {
      return err(new CourseCycleNotFoundError(uuid));
    }

    // Only Primario/Secundario support the concept — Inicial/Terciario → 422 (AC-A scope).
    if (!cc.requiresGradingPhase()) {
      return err(new GradingPhaseNotApplicableError(uuid));
    }

    if (input.gradingPhase === null) {
      cc.setGradingPhase(null);
    } else {
      const phaseResult = GradingPhase.create(input.gradingPhase);
      if (phaseResult.isErr()) {
        return err(phaseResult.unwrapErr());
      }
      cc.setGradingPhase(phaseResult.unwrap());
    }

    await this.courseCycleRepo.save(cc);

    return ok({ gradingPhase: input.gradingPhase });
  }
}
