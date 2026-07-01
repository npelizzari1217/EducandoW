/**
 * GradingPhaseAuthorizerPort — domain port (fase-bimestre-cierre-asistencia, PR-1).
 *
 * Abstracts the authorization decision for the grading PHASE gate — distinct
 * from `AssignmentAuthorizerPort` (which decides WHO may write grades). This
 * port decides WHEN a write is permitted given the CourseCycle's current
 * gradingPhase. The two gates run in sequence and are fully independent;
 * this port must never be merged into `AssignmentAuthorizerPort`.
 *
 * Contract:
 *   - Levels that do not require a grading phase (Inicial/Terciario) are
 *     always allowed, with reason 'NOT_APPLICABLE'.
 *   - A CourseCycle with no active phase (null) rejects every write
 *     (hard cutover) with reason 'NO_PHASE'.
 *   - `canGradeBimester`: allowed only when the active phase is the
 *     matching BIM_n; a mismatched bimester yields 'WRONG_BIMESTER'; CIERRE
 *     yields 'IS_CIERRE'.
 *   - `canGradeFinal`: allowed only during CIERRE; any active bimester
 *     yields 'NOT_CIERRE'.
 */

export const GRADING_PHASE_AUTHORIZER = 'GradingPhaseAuthorizerPort' as const;

export type PhaseDecisionReason =
  | 'ALLOWED'
  | 'NO_PHASE'
  | 'WRONG_BIMESTER'
  | 'IS_CIERRE'
  | 'NOT_CIERRE'
  | 'NOT_APPLICABLE';

export interface PhaseDecision {
  allowed: boolean;
  reason: PhaseDecisionReason;
}

export interface GradingPhaseAuthorizerPort {
  /**
   * ¿Se puede calificar el bimestre `periodOrdinal` (1..4) para este CourseCycle ahora?
   */
  canGradeBimester(courseCycleId: string, periodOrdinal: number): Promise<PhaseDecision>;

  /**
   * ¿Se pueden editar notas especiales (SubjectFinalGrade) para este CourseCycle ahora?
   */
  canGradeFinal(courseCycleId: string): Promise<PhaseDecision>;
}
