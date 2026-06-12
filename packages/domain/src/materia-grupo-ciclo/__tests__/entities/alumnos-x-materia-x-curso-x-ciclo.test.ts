/**
 * AlumnosXMateriaXCursoXCiclo — Domain entity tests (Fase 3b)
 * Specs: MGC-R2, MGC-S4, MGC-S9, MGC-S11
 * Tasks: F3-D2
 */
import { describe, it, expect } from 'vitest';
import { AlumnosXMateriaXCursoXCiclo } from '../../entities/alumnos-x-materia-x-curso-x-ciclo';

describe('AlumnosXMateriaXCursoXCiclo entity', () => {
  const validInput = {
    materiaXCursoXCicloId: 'mxcc-1',
    studentId: 'student-1',
  };

  it('create generates an id', () => {
    const a = AlumnosXMateriaXCursoXCiclo.create(validInput);
    expect(a.id).toBeTruthy();
    expect(typeof a.id).toBe('string');
  });

  it('two create() calls produce different ids', () => {
    const a = AlumnosXMateriaXCursoXCiclo.create(validInput);
    const b = AlumnosXMateriaXCursoXCiclo.create(validInput);
    expect(a.id).not.toBe(b.id);
  });

  it('exposes materiaXCursoXCicloId and studentId', () => {
    const a = AlumnosXMateriaXCursoXCiclo.create(validInput);
    expect(a.materiaXCursoXCicloId).toBe('mxcc-1');
    expect(a.studentId).toBe('student-1');
  });

  it('reconstruct preserves all fields', () => {
    const now = new Date('2026-01-01');
    const a = AlumnosXMateriaXCursoXCiclo.reconstruct({
      id: 'fixed-id',
      materiaXCursoXCicloId: 'mxcc-1',
      studentId: 'student-99',
      createdAt: now,
      updatedAt: now,
    });
    expect(a.id).toBe('fixed-id');
    expect(a.studentId).toBe('student-99');
    expect(a.createdAt).toBe(now);
  });

  // MGC-R2: students come from enrolled registry (domain validates non-empty ids)
  it('create throws if materiaXCursoXCicloId is empty', () => {
    expect(() =>
      AlumnosXMateriaXCursoXCiclo.create({ materiaXCursoXCicloId: '', studentId: 's-1' })
    ).toThrow();
  });

  it('create throws if studentId is empty', () => {
    expect(() =>
      AlumnosXMateriaXCursoXCiclo.create({ materiaXCursoXCicloId: 'mxcc-1', studentId: '' })
    ).toThrow();
  });

  // MGC-S9: student in universe can be added — entity level: just needs valid ids
  it('create with valid ids succeeds (represents universe membership)', () => {
    const a = AlumnosXMateriaXCursoXCiclo.create({ materiaXCursoXCicloId: 'mxcc-1', studentId: 'student-1' });
    expect(a.id).toBeTruthy();
  });
});
