/**
 * AlumnosXCursoXCiclo — Domain entity tests (SDD-1)
 * Specs: R-1, R-14, R-17, R-18, R-19, S-10
 * Tasks: T-03
 */
import { describe, it, expect } from 'vitest';
import { AlumnosXCursoXCiclo } from '../../entities/alumnos-x-curso-x-ciclo';

describe('AlumnosXCursoXCiclo entity', () => {
  const validInput = {
    courseCycleId: 'cc-uuid-1',
    studentId: 'student-1',
  };

  // create() — basic creation
  it('create generates a non-empty id', () => {
    const a = AlumnosXCursoXCiclo.create(validInput);
    expect(a.id).toBeTruthy();
    expect(typeof a.id).toBe('string');
  });

  it('two create() calls produce different ids', () => {
    const a = AlumnosXCursoXCiclo.create(validInput);
    const b = AlumnosXCursoXCiclo.create(validInput);
    expect(a.id).not.toBe(b.id);
  });

  it('exposes courseCycleId and studentId', () => {
    const a = AlumnosXCursoXCiclo.create(validInput);
    expect(a.courseCycleId).toBe('cc-uuid-1');
    expect(a.studentId).toBe('student-1');
  });

  // S-10: printable defaults to false and is never set by create()
  it('printable defaults to false', () => {
    const a = AlumnosXCursoXCiclo.create(validInput);
    expect(a.printable).toBe(false);
  });

  // create() — validation
  it('create throws if courseCycleId is empty', () => {
    expect(() =>
      AlumnosXCursoXCiclo.create({ courseCycleId: '', studentId: 'student-1' })
    ).toThrow();
  });

  it('create throws if studentId is empty', () => {
    expect(() =>
      AlumnosXCursoXCiclo.create({ courseCycleId: 'cc-uuid-1', studentId: '' })
    ).toThrow();
  });

  // reconstruct() — full restoration of persisted fields
  it('reconstruct preserves all fields including printable, createdAt, updatedAt', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const later = new Date('2026-06-01T00:00:00.000Z');

    const a = AlumnosXCursoXCiclo.reconstruct({
      id: 'fixed-id-123',
      courseCycleId: 'cc-uuid-1',
      studentId: 'student-99',
      printable: true,
      createdAt: now,
      updatedAt: later,
    });

    expect(a.id).toBe('fixed-id-123');
    expect(a.courseCycleId).toBe('cc-uuid-1');
    expect(a.studentId).toBe('student-99');
    expect(a.printable).toBe(true);
    expect(a.createdAt).toBe(now);
    expect(a.updatedAt).toBe(later);
  });

  // reconstruct() — printable false is also preserved
  it('reconstruct preserves printable=false', () => {
    const now = new Date();
    const a = AlumnosXCursoXCiclo.reconstruct({
      id: 'some-id',
      courseCycleId: 'cc-1',
      studentId: 's-1',
      printable: false,
      createdAt: now,
      updatedAt: now,
    });
    expect(a.printable).toBe(false);
  });

  // Getters
  it('createdAt and updatedAt are set after create()', () => {
    const before = new Date();
    const a = AlumnosXCursoXCiclo.create(validInput);
    const after = new Date();
    expect(a.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(a.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(a.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
