import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

// ─── Enum ─────────────────────────────────────────────────────────────────────

/**
 * The four final grade instances for a subject (AD-2).
 * Stored as a Prisma enum; each row in SubjectFinalGrade is keyed by this type.
 *
 * Conditional lifecycle (enforced in use case, not entity):
 *   DICIEMBRE — only if FINAL.passed !== true
 *   MARZO     — only if DICIEMBRE.passed !== true
 *   DEFINITIVA — always available (manual closing verdict)
 */
export enum SubjectFinalGradeType {
  FINAL      = 'FINAL',
  DICIEMBRE  = 'DICIEMBRE',
  MARZO      = 'MARZO',
  DEFINITIVA = 'DEFINITIVA',
}

const VALID_VALUES = new Set<string>(Object.values(SubjectFinalGradeType));

/**
 * Parses a raw string into a SubjectFinalGradeType.
 * Returns ValidationError for unknown values (SFG-R8).
 */
export function fromSubjectFinalGradeTypeString(
  value: string,
): Result<SubjectFinalGradeType, ValidationError> {
  if (VALID_VALUES.has(value)) {
    return ok(value as SubjectFinalGradeType);
  }
  return err(
    new ValidationError(
      `Invalid SubjectFinalGradeType: "${value}". Expected one of: ${[...VALID_VALUES].join(', ')}.`,
    ),
  );
}
