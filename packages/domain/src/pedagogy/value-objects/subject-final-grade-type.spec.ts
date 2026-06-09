/**
 * PR2-T1 [RED] — SubjectFinalGradeType VO tests.
 * Specs: SFG-R1, SFG-R8, AD-2
 */
import { describe, it, expect } from 'vitest';
import { SubjectFinalGradeType, fromSubjectFinalGradeTypeString } from './subject-final-grade-type';

describe('SubjectFinalGradeType — fromString', () => {
  it('returns FINAL for "FINAL"', () => {
    const result = fromSubjectFinalGradeTypeString('FINAL');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(SubjectFinalGradeType.FINAL);
  });

  it('returns DICIEMBRE for "DICIEMBRE"', () => {
    const result = fromSubjectFinalGradeTypeString('DICIEMBRE');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(SubjectFinalGradeType.DICIEMBRE);
  });

  it('returns MARZO for "MARZO"', () => {
    const result = fromSubjectFinalGradeTypeString('MARZO');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(SubjectFinalGradeType.MARZO);
  });

  it('returns DEFINITIVA for "DEFINITIVA"', () => {
    const result = fromSubjectFinalGradeTypeString('DEFINITIVA');
    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toBe(SubjectFinalGradeType.DEFINITIVA);
  });

  it('returns ValidationError for an unknown value', () => {
    const result = fromSubjectFinalGradeTypeString('INVALID');
    expect(result.isErr()).toBe(true);
  });

  it('returns ValidationError for an empty string', () => {
    const result = fromSubjectFinalGradeTypeString('');
    expect(result.isErr()).toBe(true);
  });

  it('round-trips all four values — string → enum → string', () => {
    const values = ['FINAL', 'DICIEMBRE', 'MARZO', 'DEFINITIVA'] as const;
    for (const v of values) {
      const result = fromSubjectFinalGradeTypeString(v);
      expect(result.isOk()).toBe(true);
      // The enum value equals the string itself (const enum pattern)
      expect(result.unwrap()).toBe(v);
    }
  });
});
