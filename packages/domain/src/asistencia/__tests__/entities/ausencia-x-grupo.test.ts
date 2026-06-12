/**
 * AusenciaXGrupo entity tests — Fase 6
 * TDD: RED → GREEN
 */
import { describe, it, expect } from 'vitest';
import { AusenciaXGrupo } from '../../entities/ausencia-x-grupo';
import { Id } from '../../../shared/value-objects/id';

describe('AusenciaXGrupo', () => {
  const date = new Date('2026-08-10');

  it('create() generates a new id and stores all props', () => {
    const a = AusenciaXGrupo.create({
      grupoId: 'grupo-1',
      studentId: 'student-1',
      date,
      observaciones: 'llegó tarde',
    });

    expect(a.id.get()).toHaveLength(36); // UUID
    expect(a.grupoId).toBe('grupo-1');
    expect(a.studentId).toBe('student-1');
    expect(a.date).toStrictEqual(date);
    expect(a.observaciones).toBe('llegó tarde');
  });

  it('create() without observaciones leaves it undefined', () => {
    const a = AusenciaXGrupo.create({
      grupoId: 'grupo-1',
      studentId: 'student-1',
      date,
    });

    expect(a.observaciones).toBeUndefined();
  });

  it('reconstruct() restores all props including id and timestamps', () => {
    const id = '00000000-0000-0000-0000-000000000001';
    const createdAt = new Date('2026-06-01');
    const updatedAt = new Date('2026-06-02');

    const a = AusenciaXGrupo.reconstruct({
      id: Id.reconstruct(id),
      grupoId: 'grupo-2',
      studentId: 'student-2',
      date,
      observaciones: 'nota',
      createdAt,
      updatedAt,
    });

    expect(a.id.get()).toBe(id);
    expect(a.grupoId).toBe('grupo-2');
    expect(a.studentId).toBe('student-2');
    expect(a.createdAt).toStrictEqual(createdAt);
    expect(a.updatedAt).toStrictEqual(updatedAt);
  });

  it('two create() calls produce different ids', () => {
    const props = { grupoId: 'g', studentId: 's', date };
    const a1 = AusenciaXGrupo.create(props);
    const a2 = AusenciaXGrupo.create(props);
    expect(a1.id.get()).not.toBe(a2.id.get());
  });
});
