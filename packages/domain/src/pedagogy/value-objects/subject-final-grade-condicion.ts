import { Result, ok, err } from '../../shared/result';
import { ValidationError } from '../../shared/errors/validation-error';

// ─── Enum ─────────────────────────────────────────────────────────────────────

/**
 * The three condicion values for a Secundario final grade (D1).
 * Stored as a Prisma enum on the nullable `condicion` column of SubjectFinalGrade.
 *
 * Year-end verdict for the subject — set explicitly by the teacher on the FINAL row.
 * The boletín reads it from FINAL (fallback DEFINITIVA).
 *
 * NOTE: This is intentionally SEPARATE from `condicion-alumno.ts` in the secundario
 * bounded context, which carries `APROBADO | PREVIA | LIBRE` and uses a different
 * style contract. This pedagogy VO keeps grading level-agnostic.
 *
 * Cross-field validation (LIBRE+passed=true → reject, PREVIA+passed=true → reject)
 * lives in the USE CASE (UpsertSubjectFinalGrades), not in the entity — mirrors the
 * AD-2/AD-7 precedent for DICIEMBRE/MARZO lifecycle (D1).
 */
export enum SubjectFinalGradeCondicion {
  REGULAR = 'REGULAR',
  PREVIA  = 'PREVIA',
  LIBRE   = 'LIBRE',
}

const VALID_VALUES = new Set<string>(Object.values(SubjectFinalGradeCondicion));

/**
 * Parses a raw string into a SubjectFinalGradeCondicion.
 * Returns ValidationError for unknown values (C-R2).
 */
export function fromSubjectFinalGradeCondicionString(
  value: string,
): Result<SubjectFinalGradeCondicion, ValidationError> {
  if (VALID_VALUES.has(value)) {
    return ok(value as SubjectFinalGradeCondicion);
  }
  return err(
    new ValidationError(
      `Invalid SubjectFinalGradeCondicion: "${value}". Expected one of: ${[...VALID_VALUES].join(', ')}.`,
    ),
  );
}
