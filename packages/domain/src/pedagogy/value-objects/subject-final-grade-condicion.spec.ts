/**
 * PR1-T1 [RED] — SubjectFinalGradeCondicion VO tests.
 * Specs: C-R1, C-R2, D1
 *
 * NOTE: SubjectFinalGradeCondicion (REGULAR | PREVIA | LIBRE) is intentionally
 * separate from `condicion-alumno.ts` (APROBADO | PREVIA | LIBRE) — different
 * member set, different style contract. This VO lives in the pedagogy module to
 * keep grading level-agnostic.
 */
import { describe, it, expect } from 'vitest';
import {
  SubjectFinalGradeCondicion,
  fromSubjectFinalGradeCondicionString,
} from './subject-final-grade-condicion';
import { ValidationError } from '../../shared/errors/validation-error';

describe('SubjectFinalGradeCondicion — fromString', () => {
  it('returns REGULAR for "REGULAR"', () => {
    const result = fromSubjectFinalGradeCondicionString('REGULAR');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(SubjectFinalGradeCondicion.REGULAR);
  });

  it('returns PREVIA for "PREVIA"', () => {
    const result = fromSubjectFinalGradeCondicionString('PREVIA');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(SubjectFinalGradeCondicion.PREVIA);
  });

  it('returns LIBRE for "LIBRE"', () => {
    const result = fromSubjectFinalGradeCondicionString('LIBRE');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(SubjectFinalGradeCondicion.LIBRE);
  });

  it('returns ValidationError for an unknown value', () => {
    const result = fromSubjectFinalGradeCondicionString('INVALID');
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  it('returns ValidationError for "APROBADO" (wrong type — see condicion-alumno.ts)', () => {
    const result = fromSubjectFinalGradeCondicionString('APROBADO');
    expect(result.isErr()).toBe(true);
  });

  it('returns ValidationError for an empty string', () => {
    const result = fromSubjectFinalGradeCondicionString('');
    expect(result.isErr()).toBe(true);
  });

  it('round-trips all three values — string → enum → string', () => {
    const values = ['REGULAR', 'PREVIA', 'LIBRE'] as const;
    for (const v of values) {
      const result = fromSubjectFinalGradeCondicionString(v);
      expect(result.isOk()).toBe(true);
      // The enum value equals the string itself (const enum pattern)
      expect(result.unwrap()).toBe(v);
    }
  });

  it('enum values are value-equal to their string literals', () => {
    expect(SubjectFinalGradeCondicion.REGULAR).toBe('REGULAR');
    expect(SubjectFinalGradeCondicion.PREVIA).toBe('PREVIA');
    expect(SubjectFinalGradeCondicion.LIBRE).toBe('LIBRE');
  });
});
