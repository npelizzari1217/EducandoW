/**
 * PR2-T1 [RED] — MateriaPrevia entity tests.
 * Specs: MP-R1, MP-R2, MP-R3, MP-R4, MP-R7, D2
 *
 * CRITICAL domain invariant (PR2-T1):
 *   MateriaPrevia CANNOT exist with condicion = REGULAR.
 *   Only PREVIA or LIBRE are valid condicion values for a materia previa.
 *   (REGULAR is a valid SubjectFinalGradeCondicion in other contexts — that's exactly
 *   why this guard is easy to miss.)
 */
import { describe, it, expect } from 'vitest';
import { MateriaPrevia, MateriaPreviaStatus } from './materia-previa';
import { SubjectFinalGradeCondicion } from '../../pedagogy/value-objects/subject-final-grade-condicion';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCreateInput(overrides: Partial<{
  studentId: string;
  subjectId: string;
  originAcademicYear: string;
  originCourseCycleId: string;
  condicion: SubjectFinalGradeCondicion;
}> = {}) {
  return {
    studentId:          'student-uuid-1',
    subjectId:          'subject-uuid-1',
    originAcademicYear: '2024',
    condicion:          SubjectFinalGradeCondicion.PREVIA,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// create() — success paths
// ═══════════════════════════════════════════════════════════════════════════════

describe('MateriaPrevia.create() — success', () => {
  it('creates with condicion=PREVIA and status defaults to PENDIENTE', () => {
    const result = MateriaPrevia.create(makeCreateInput({ condicion: SubjectFinalGradeCondicion.PREVIA }));

    expect(result.isOk()).toBe(true);
    const mp = result.unwrap();
    expect(mp.status).toBe(MateriaPreviaStatus.PENDIENTE);
    expect(mp.condicion).toBe(SubjectFinalGradeCondicion.PREVIA);
  });

  it('creates with condicion=LIBRE and status defaults to PENDIENTE', () => {
    const result = MateriaPrevia.create(makeCreateInput({ condicion: SubjectFinalGradeCondicion.LIBRE }));

    expect(result.isOk()).toBe(true);
    const mp = result.unwrap();
    expect(mp.status).toBe(MateriaPreviaStatus.PENDIENTE);
    expect(mp.condicion).toBe(SubjectFinalGradeCondicion.LIBRE);
  });

  it('preserves all input fields', () => {
    const input = makeCreateInput({
      studentId:          'stu-abc',
      subjectId:          'sub-xyz',
      originAcademicYear: '2023',
      originCourseCycleId: 'cc-001',
      condicion:          SubjectFinalGradeCondicion.PREVIA,
    });
    const result = MateriaPrevia.create(input);

    expect(result.isOk()).toBe(true);
    const mp = result.unwrap();
    expect(mp.studentId).toBe('stu-abc');
    expect(mp.subjectId).toBe('sub-xyz');
    expect(mp.originAcademicYear).toBe('2023');
    expect(mp.originCourseCycleId).toBe('cc-001');
  });

  it('sets resolvedGradeCode and resolvedAt to null on creation', () => {
    const result = MateriaPrevia.create(makeCreateInput());

    expect(result.isOk()).toBe(true);
    const mp = result.unwrap();
    expect(mp.resolvedGradeCode).toBeUndefined();
    expect(mp.resolvedAt).toBeUndefined();
  });

  it('generates a non-empty id', () => {
    const result = MateriaPrevia.create(makeCreateInput());
    expect(result.isOk()).toBe(true);
    expect(result.unwrap().id).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// create() — CRITICAL domain invariant: condicion=REGULAR rejected
// ═══════════════════════════════════════════════════════════════════════════════

describe('MateriaPrevia.create() — condicion=REGULAR invariant', () => {
  it('rejects condicion=REGULAR with ValidationError (REGULAR is only valid for final grades, not previas)', () => {
    const result = MateriaPrevia.create(makeCreateInput({ condicion: SubjectFinalGradeCondicion.REGULAR }));

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/REGULAR/i);
  });

  it('ValidationError message mentions REGULAR is invalid for a materia previa', () => {
    const result = MateriaPrevia.create(makeCreateInput({ condicion: SubjectFinalGradeCondicion.REGULAR }));

    expect(result.isErr()).toBe(true);
    const error = result.unwrapErr();
    expect(error.message).toContain('REGULAR');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// create() — validation: required fields
// ═══════════════════════════════════════════════════════════════════════════════

describe('MateriaPrevia.create() — field validation', () => {
  it('rejects empty subjectId', () => {
    const result = MateriaPrevia.create(makeCreateInput({ subjectId: '' }));
    expect(result.isErr()).toBe(true);
  });

  it('rejects empty originAcademicYear', () => {
    const result = MateriaPrevia.create(makeCreateInput({ originAcademicYear: '' }));
    expect(result.isErr()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// resolve() — transitions status to APROBADA
// ═══════════════════════════════════════════════════════════════════════════════

describe('MateriaPrevia.resolve()', () => {
  it('transitions status to APROBADA and snapshots gradeCode', () => {
    const mp = MateriaPrevia.create(makeCreateInput()).unwrap();
    const before = new Date();

    const result = mp.resolve('10');

    const after = new Date();
    expect(result.isOk()).toBe(true);
    expect(mp.status).toBe(MateriaPreviaStatus.APROBADA);
    expect(mp.resolvedGradeCode).toBe('10');
    expect(mp.resolvedAt).toBeDefined();
    expect(mp.resolvedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(mp.resolvedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('rejects empty gradeCode', () => {
    const mp = MateriaPrevia.create(makeCreateInput()).unwrap();
    const result = mp.resolve('');
    expect(result.isErr()).toBe(true);
  });

  it('rejects whitespace-only gradeCode', () => {
    const mp = MateriaPrevia.create(makeCreateInput()).unwrap();
    const result = mp.resolve('   ');
    expect(result.isErr()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// markLibre() — transitions status to LIBRE
// ═══════════════════════════════════════════════════════════════════════════════

describe('MateriaPrevia.markLibre()', () => {
  it('transitions status to LIBRE', () => {
    const mp = MateriaPrevia.create(makeCreateInput()).unwrap();

    const result = mp.markLibre();

    expect(result.isOk()).toBe(true);
    expect(mp.status).toBe(MateriaPreviaStatus.LIBRE);
  });

  it('returns Result<void,never> — never an error', () => {
    const mp = MateriaPrevia.create(makeCreateInput()).unwrap();
    const result = mp.markLibre();
    expect(result.isErr()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// reconstruct() — round-trips all fields
// ═══════════════════════════════════════════════════════════════════════════════

describe('MateriaPrevia.reconstruct()', () => {
  it('round-trips all fields including resolvedAt', () => {
    const resolvedAt = new Date('2024-06-15T10:00:00Z');
    const props = {
      id:                 'mp-uuid-1',
      studentId:          'stu-1',
      subjectId:          'sub-1',
      originAcademicYear: '2023',
      originCourseCycleId: 'cc-1',
      condicion:          SubjectFinalGradeCondicion.PREVIA,
      status:             MateriaPreviaStatus.APROBADA,
      resolvedGradeCode:  '8',
      resolvedAt,
      createdAt:          new Date('2024-01-01'),
      updatedAt:          new Date('2024-06-15'),
    };

    const mp = MateriaPrevia.reconstruct(props);

    expect(mp.id).toBe('mp-uuid-1');
    expect(mp.studentId).toBe('stu-1');
    expect(mp.subjectId).toBe('sub-1');
    expect(mp.originAcademicYear).toBe('2023');
    expect(mp.originCourseCycleId).toBe('cc-1');
    expect(mp.condicion).toBe(SubjectFinalGradeCondicion.PREVIA);
    expect(mp.status).toBe(MateriaPreviaStatus.APROBADA);
    expect(mp.resolvedGradeCode).toBe('8');
    expect(mp.resolvedAt).toBe(resolvedAt);
    expect(mp.createdAt).toEqual(new Date('2024-01-01'));
    expect(mp.updatedAt).toEqual(new Date('2024-06-15'));
  });

  it('round-trips condicion=LIBRE with status=LIBRE', () => {
    const props = {
      id:                 'mp-uuid-2',
      studentId:          'stu-2',
      subjectId:          'sub-2',
      originAcademicYear: '2024',
      condicion:          SubjectFinalGradeCondicion.LIBRE,
      status:             MateriaPreviaStatus.LIBRE,
      createdAt:          new Date(),
      updatedAt:          new Date(),
    };

    const mp = MateriaPrevia.reconstruct(props);

    expect(mp.condicion).toBe(SubjectFinalGradeCondicion.LIBRE);
    expect(mp.status).toBe(MateriaPreviaStatus.LIBRE);
    expect(mp.resolvedGradeCode).toBeUndefined();
    expect(mp.resolvedAt).toBeUndefined();
    expect(mp.originCourseCycleId).toBeUndefined();
  });
});
