/**
 * AsistenciaXMateriaXAlumnoXCursoXCiclo entity tests — TDD RED phase
 * Spec: R-3, R-36
 */
import { describe, it, expect } from 'vitest';
import { AsistenciaXMateriaXAlumnoXCursoXCiclo } from '../../entities/asistencia-x-materia-x-alumno-x-curso-x-ciclo';
import { DayMap } from '../../value-objects/day-map';
import { Id } from '../../../shared/value-objects/id';

describe('AsistenciaXMateriaXAlumnoXCursoXCiclo', () => {
  const baseProps = {
    materiaXCursoXCicloId: 'materia-uuid-1',
    studentId: 'student-uuid-1',
    year: 2026,
    month: 7,
  };

  describe('create()', () => {
    it('generates a new UUID id', () => {
      const entity = AsistenciaXMateriaXAlumnoXCursoXCiclo.create(baseProps);
      expect(entity.id.get()).toHaveLength(36);
    });

    it('stores all required props', () => {
      const entity = AsistenciaXMateriaXAlumnoXCursoXCiclo.create(baseProps);
      expect(entity.materiaXCursoXCicloId).toBe('materia-uuid-1');
      expect(entity.studentId).toBe('student-uuid-1');
      expect(entity.year).toBe(2026);
      expect(entity.month).toBe(7);
    });

    it('starts with an empty DayMap', () => {
      const entity = AsistenciaXMateriaXAlumnoXCursoXCiclo.create(baseProps);
      expect(entity.days.toJSON()).toEqual({});
    });

    it('holds a DayMap instance', () => {
      const entity = AsistenciaXMateriaXAlumnoXCursoXCiclo.create(baseProps);
      expect(entity.days).toBeInstanceOf(DayMap);
    });

    it('two create() calls produce different ids', () => {
      const e1 = AsistenciaXMateriaXAlumnoXCursoXCiclo.create(baseProps);
      const e2 = AsistenciaXMateriaXAlumnoXCursoXCiclo.create(baseProps);
      expect(e1.id.get()).not.toBe(e2.id.get());
    });
  });

  describe('reconstruct()', () => {
    it('rehydrates entity from persisted props including DayMap from JSON record', () => {
      const id = '00000000-0000-0000-0000-000000000010';
      const daysRecord = { '5': 'P', '6': 'A', '20': 'P' };
      const createdAt = new Date('2026-07-01');
      const updatedAt = new Date('2026-07-10');

      const entity = AsistenciaXMateriaXAlumnoXCursoXCiclo.reconstruct({
        id: Id.reconstruct(id),
        ...baseProps,
        days: DayMap.fromRecord(daysRecord),
        createdAt,
        updatedAt,
      });

      expect(entity.id.get()).toBe(id);
      expect(entity.materiaXCursoXCicloId).toBe('materia-uuid-1');
      expect(entity.studentId).toBe('student-uuid-1');
      expect(entity.year).toBe(2026);
      expect(entity.month).toBe(7);
      expect(entity.days).toBeInstanceOf(DayMap);
      expect(entity.days.get(5)).toBe('P');
      expect(entity.days.get(6)).toBe('A');
      expect(entity.days.get(20)).toBe('P');
      expect(entity.createdAt).toStrictEqual(createdAt);
      expect(entity.updatedAt).toStrictEqual(updatedAt);
    });

    it('reconstruct() with empty days produces empty DayMap', () => {
      const entity = AsistenciaXMateriaXAlumnoXCursoXCiclo.reconstruct({
        id: Id.reconstruct('00000000-0000-0000-0000-000000000011'),
        ...baseProps,
        days: DayMap.empty(),
      });
      expect(entity.days.toJSON()).toEqual({});
    });
  });
});
