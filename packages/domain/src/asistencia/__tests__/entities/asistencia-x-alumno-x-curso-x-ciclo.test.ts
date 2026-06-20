/**
 * AsistenciaXAlumnoXCursoXCiclo entity tests — TDD RED phase
 * Spec: R-1, R-3, R-36
 */
import { describe, it, expect } from 'vitest';
import { AsistenciaXAlumnoXCursoXCiclo } from '../../entities/asistencia-x-alumno-x-curso-x-ciclo';
import { DayMap } from '../../value-objects/day-map';
import { Id } from '../../../shared/value-objects/id';

describe('AsistenciaXAlumnoXCursoXCiclo', () => {
  const baseProps = {
    courseCycleId: 'cc-uuid-1',
    studentId: 'student-uuid-1',
    year: 2026,
    month: 6,
  };

  describe('create()', () => {
    it('generates a new UUID id', () => {
      const entity = AsistenciaXAlumnoXCursoXCiclo.create(baseProps);
      expect(entity.id.get()).toHaveLength(36);
    });

    it('stores all required props', () => {
      const entity = AsistenciaXAlumnoXCursoXCiclo.create(baseProps);
      expect(entity.courseCycleId).toBe('cc-uuid-1');
      expect(entity.studentId).toBe('student-uuid-1');
      expect(entity.year).toBe(2026);
      expect(entity.month).toBe(6);
    });

    it('starts with an empty DayMap', () => {
      const entity = AsistenciaXAlumnoXCursoXCiclo.create(baseProps);
      expect(entity.days.toJSON()).toEqual({});
    });

    it('holds a DayMap instance (not a plain object)', () => {
      const entity = AsistenciaXAlumnoXCursoXCiclo.create(baseProps);
      expect(entity.days).toBeInstanceOf(DayMap);
    });

    it('two create() calls produce different ids', () => {
      const e1 = AsistenciaXAlumnoXCursoXCiclo.create(baseProps);
      const e2 = AsistenciaXAlumnoXCursoXCiclo.create(baseProps);
      expect(e1.id.get()).not.toBe(e2.id.get());
    });
  });

  describe('reconstruct()', () => {
    it('rehydrates entity from persisted props including DayMap from JSON record', () => {
      const id = '00000000-0000-0000-0000-000000000001';
      const daysRecord = { '1': 'P', '2': 'A', '10': 'SAB' };
      const createdAt = new Date('2026-06-01');
      const updatedAt = new Date('2026-06-15');

      const entity = AsistenciaXAlumnoXCursoXCiclo.reconstruct({
        id: Id.reconstruct(id),
        ...baseProps,
        days: DayMap.fromRecord(daysRecord),
        createdAt,
        updatedAt,
      });

      expect(entity.id.get()).toBe(id);
      expect(entity.courseCycleId).toBe('cc-uuid-1');
      expect(entity.studentId).toBe('student-uuid-1');
      expect(entity.year).toBe(2026);
      expect(entity.month).toBe(6);
      expect(entity.days).toBeInstanceOf(DayMap);
      expect(entity.days.get(1)).toBe('P');
      expect(entity.days.get(2)).toBe('A');
      expect(entity.days.get(10)).toBe('SAB');
      expect(entity.createdAt).toStrictEqual(createdAt);
      expect(entity.updatedAt).toStrictEqual(updatedAt);
    });

    it('reconstruct() with empty days record produces empty DayMap', () => {
      const entity = AsistenciaXAlumnoXCursoXCiclo.reconstruct({
        id: Id.reconstruct('00000000-0000-0000-0000-000000000002'),
        ...baseProps,
        days: DayMap.empty(),
      });
      expect(entity.days.toJSON()).toEqual({});
    });
  });

  describe('getters are immutable (return values, not references)', () => {
    it('DayMap getter returns the same logical value on repeated calls', () => {
      const entity = AsistenciaXAlumnoXCursoXCiclo.create(baseProps);
      expect(entity.days.toJSON()).toEqual(entity.days.toJSON());
    });
  });
});
