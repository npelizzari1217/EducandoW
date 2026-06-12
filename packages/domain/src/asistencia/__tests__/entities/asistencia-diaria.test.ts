/**
 * AsistenciaDiaria entity tests — Fase 6
 * TDD: RED → GREEN
 */
import { describe, it, expect } from 'vitest';
import { AsistenciaDiaria } from '../../entities/asistencia-diaria';
import { Id } from '../../../shared/value-objects/id';

describe('AsistenciaDiaria', () => {
  const date = new Date('2026-08-10');

  it('create() generates a new id and stores all props', () => {
    const a = AsistenciaDiaria.create({
      courseCycleId: 'cc-1',
      studentId: 'student-1',
      date,
      statusCode: 'P',
    });

    expect(a.id.get()).toHaveLength(36);
    expect(a.courseCycleId).toBe('cc-1');
    expect(a.studentId).toBe('student-1');
    expect(a.date).toStrictEqual(date);
    expect(a.statusCode).toBe('P');
    expect(a.observaciones).toBeUndefined();
  });

  it('create() stores optional observaciones', () => {
    const a = AsistenciaDiaria.create({
      courseCycleId: 'cc-1',
      studentId: 'student-1',
      date,
      statusCode: 'A',
      observaciones: 'inasistencia injustificada',
    });

    expect(a.statusCode).toBe('A');
    expect(a.observaciones).toBe('inasistencia injustificada');
  });

  it('reconstruct() restores all props including id and timestamps', () => {
    const id = '00000000-0000-0000-0000-000000000002';
    const createdAt = new Date('2026-06-01');
    const updatedAt = new Date('2026-06-02');

    const a = AsistenciaDiaria.reconstruct({
      id: Id.reconstruct(id),
      courseCycleId: 'cc-2',
      studentId: 'student-2',
      date,
      statusCode: 'P',
      createdAt,
      updatedAt,
    });

    expect(a.id.get()).toBe(id);
    expect(a.courseCycleId).toBe('cc-2');
    expect(a.studentId).toBe('student-2');
    expect(a.createdAt).toStrictEqual(createdAt);
    expect(a.updatedAt).toStrictEqual(updatedAt);
  });

  it('two create() calls produce different ids', () => {
    const props = { courseCycleId: 'cc', studentId: 's', date, statusCode: 'P' };
    const a1 = AsistenciaDiaria.create(props);
    const a2 = AsistenciaDiaria.create(props);
    expect(a1.id.get()).not.toBe(a2.id.get());
  });
});
