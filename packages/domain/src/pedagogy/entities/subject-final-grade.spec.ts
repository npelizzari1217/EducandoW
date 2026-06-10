/**
 * PR2-T3 [RED] — SubjectFinalGrade entity tests.
 * Specs: SFG-R1, SFG-R4, SFG-R5, AD-2
 *
 * PR1-T3 [RED] — condicion extension tests added below.
 * Specs: C-R3, D1
 */
import { describe, it, expect } from 'vitest';
import { SubjectFinalGrade } from './subject-final-grade';
import { SubjectFinalGradeType } from '../value-objects/subject-final-grade-type';
import { SubjectFinalGradeCondicion } from '../value-objects/subject-final-grade-condicion';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCreateInput(overrides: Partial<{
  studentId: string;
  courseCycleId: string;
  subjectId: string;
  type: SubjectFinalGradeType;
}> = {}) {
  return {
    studentId:     'student-uuid-1',
    courseCycleId: 'cc-uuid-1',
    subjectId:     'subj-uuid-1',
    type:          SubjectFinalGradeType.FINAL,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// create() — ungraded defaults
// ═══════════════════════════════════════════════════════════════════════════════

describe('SubjectFinalGrade.create()', () => {
  it('creates an ungraded row — grade fields null', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());

    expect(grade.gradeScaleValueId).toBeNull();
    expect(grade.gradeCode).toBeNull();
    expect(grade.internalStatus).toBeNull();
  });

  it('creates an ungraded row — passed is null by default', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());

    expect(grade.passed).toBeNull();
  });

  it('assigns the correct type', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput({ type: SubjectFinalGradeType.DICIEMBRE }));

    expect(grade.type).toBe(SubjectFinalGradeType.DICIEMBRE);
  });

  it('binds to the correct student/courseCycle/subject', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput({
      studentId:     's-1',
      courseCycleId: 'cc-1',
      subjectId:     'subj-1',
    }));

    expect(grade.studentId).toBe('s-1');
    expect(grade.courseCycleId).toBe('cc-1');
    expect(grade.subjectId).toBe('subj-1');
  });

  it('generates a unique id', () => {
    const a = SubjectFinalGrade.create(makeCreateInput());
    const b = SubjectFinalGrade.create(makeCreateInput());

    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// assignGrade()
// ═══════════════════════════════════════════════════════════════════════════════

describe('SubjectFinalGrade.assignGrade()', () => {
  it('assigns grade fields when gradeCode is non-empty', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());

    const result = grade.assignGrade({
      gradeScaleValueId: 'sv-uuid-1',
      gradeCode: 'MB',
      internalStatus: 'APROBADO',
    });

    expect(result.isOk()).toBe(true);
    expect(grade.gradeScaleValueId).toBe('sv-uuid-1');
    expect(grade.gradeCode).toBe('MB');
    expect(grade.internalStatus).toBe('APROBADO');
  });

  it('returns ValidationError when gradeCode is empty string', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());

    const result = grade.assignGrade({
      gradeScaleValueId: 'sv-uuid-1',
      gradeCode: '',
      internalStatus: 'APROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(grade.gradeCode).toBeNull(); // not mutated on error
  });

  it('returns ValidationError when gradeCode is whitespace only', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());

    const result = grade.assignGrade({
      gradeScaleValueId: 'sv-uuid-1',
      gradeCode: '   ',
      internalStatus: 'APROBADO',
    });

    expect(result.isErr()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// setPassed()
// ═══════════════════════════════════════════════════════════════════════════════

describe('SubjectFinalGrade.setPassed()', () => {
  it('sets passed to true', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());

    const result = grade.setPassed(true);

    expect(result.isOk()).toBe(true);
    expect(grade.passed).toBe(true);
  });

  it('sets passed to false', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());

    const result = grade.setPassed(false);

    expect(result.isOk()).toBe(true);
    expect(grade.passed).toBe(false);
  });

  it('can change passed from true to false (upsert semantics)', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());
    grade.setPassed(true);

    grade.setPassed(false);

    expect(grade.passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// reconstruct()
// ═══════════════════════════════════════════════════════════════════════════════

describe('SubjectFinalGrade.reconstruct()', () => {
  it('reconstructs all fields from persistence', () => {
    const grade = SubjectFinalGrade.reconstruct({
      id:                'sfg-uuid-1',
      studentId:         'student-1',
      courseCycleId:     'cc-1',
      subjectId:         'subj-1',
      type:              SubjectFinalGradeType.DEFINITIVA,
      gradeScaleValueId: 'sv-1',
      gradeCode:         'A',
      internalStatus:    'APROBADO',
      passed:            true,
      condicion:         null,
    });

    expect(grade.id).toBe('sfg-uuid-1');
    expect(grade.type).toBe(SubjectFinalGradeType.DEFINITIVA);
    expect(grade.gradeScaleValueId).toBe('sv-1');
    expect(grade.gradeCode).toBe('A');
    expect(grade.internalStatus).toBe('APROBADO');
    expect(grade.passed).toBe(true);
  });

  it('reconstructs with null grade fields', () => {
    const grade = SubjectFinalGrade.reconstruct({
      id:                'sfg-uuid-2',
      studentId:         'student-1',
      courseCycleId:     'cc-1',
      subjectId:         'subj-1',
      type:              SubjectFinalGradeType.FINAL,
      gradeScaleValueId: null,
      gradeCode:         null,
      internalStatus:    null,
      passed:            null,
      condicion:         null,
    });

    expect(grade.gradeScaleValueId).toBeNull();
    expect(grade.gradeCode).toBeNull();
    expect(grade.passed).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// condicion — PR1-T3 [RED] — C-R3, D1
// ═══════════════════════════════════════════════════════════════════════════════

describe('SubjectFinalGrade — condicion', () => {
  it('create() yields condicion null by default', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());

    expect(grade.condicion).toBeNull();
  });

  it('setCondicion(PREVIA) sets the condicion value', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());

    const result = grade.setCondicion(SubjectFinalGradeCondicion.PREVIA);

    expect(result.isOk()).toBe(true);
    expect(grade.condicion).toBe(SubjectFinalGradeCondicion.PREVIA);
  });

  it('setCondicion(REGULAR) sets the condicion value', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());

    grade.setCondicion(SubjectFinalGradeCondicion.REGULAR);

    expect(grade.condicion).toBe(SubjectFinalGradeCondicion.REGULAR);
  });

  it('setCondicion(LIBRE) sets the condicion value', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());

    grade.setCondicion(SubjectFinalGradeCondicion.LIBRE);

    expect(grade.condicion).toBe(SubjectFinalGradeCondicion.LIBRE);
  });

  it('setCondicion(undefined) leaves condicion as null (no-op)', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());

    grade.setCondicion(undefined);

    expect(grade.condicion).toBeNull();
  });

  it('setCondicion(undefined) after a value was set leaves condicion unchanged', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());
    grade.setCondicion(SubjectFinalGradeCondicion.REGULAR);

    grade.setCondicion(undefined);

    expect(grade.condicion).toBe(SubjectFinalGradeCondicion.REGULAR);
  });

  it('reconstruct() with condicion=LIBRE round-trips correctly', () => {
    const grade = SubjectFinalGrade.reconstruct({
      id:                'sfg-cond-1',
      studentId:         'student-1',
      courseCycleId:     'cc-1',
      subjectId:         'subj-1',
      type:              SubjectFinalGradeType.FINAL,
      gradeScaleValueId: null,
      gradeCode:         null,
      internalStatus:    null,
      passed:            null,
      condicion:         SubjectFinalGradeCondicion.LIBRE,
    });

    expect(grade.condicion).toBe(SubjectFinalGradeCondicion.LIBRE);
  });

  it('condicion is independent of grade fields — assignGrade does not affect condicion', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());
    grade.setCondicion(SubjectFinalGradeCondicion.PREVIA);

    grade.assignGrade({
      gradeScaleValueId: 'sv-1',
      gradeCode: 'B',
      internalStatus: 'NO_APROBADO',
    });

    expect(grade.condicion).toBe(SubjectFinalGradeCondicion.PREVIA);
  });

  it('condicion is independent of passed — setPassed does not affect condicion', () => {
    const grade = SubjectFinalGrade.create(makeCreateInput());
    grade.setCondicion(SubjectFinalGradeCondicion.REGULAR);

    grade.setPassed(false);

    expect(grade.condicion).toBe(SubjectFinalGradeCondicion.REGULAR);
  });
});
