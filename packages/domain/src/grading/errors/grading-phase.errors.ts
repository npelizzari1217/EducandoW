import { DomainError } from '../../shared/errors/domain-error';

/**
 * Thrown when a grade write is attempted while the CourseCycle's current
 * gradingPhase does not permit it (NULL cutover, wrong bimester, or special
 * grades outside CIERRE). HTTP 409 — the request is well-formed, but the
 * course's current state conflicts with the operation (same precedent as
 * COURSE_CYCLE_CLOSED / ACADEMIC_CYCLE_CLOSED).
 */
export class GradingPhaseViolationError extends DomainError {
  constructor(courseCycleId: string, reason: string) {
    super(
      `CourseCycle ${courseCycleId} does not allow this grading operation right now: ${reason}`,
      'GRADING_PHASE_VIOLATION',
    );
  }
}

/**
 * Thrown when attempting to SET a gradingPhase on a CourseCycle whose level
 * does not support the concept (Inicial/Terciario). HTTP 422 — the resource
 * itself does not admit the operation, distinct from a state conflict.
 */
export class GradingPhaseNotApplicableError extends DomainError {
  constructor(courseCycleId: string) {
    super(
      `CourseCycle ${courseCycleId} does not support grading phases (level is not Primario/Secundario)`,
      'GRADING_PHASE_NOT_APPLICABLE',
    );
  }
}
