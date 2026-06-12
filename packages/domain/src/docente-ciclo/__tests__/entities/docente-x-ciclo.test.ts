/**
 * Docente x Ciclo — Domain entity tests (Fase 2)
 * Specs: DC-R1, DC-R2, DC-R3, DC-R4, DC-R5
 * Tests: F2-T1, F2-T2, F2-T5 (unit side)
 */
import { describe, it, expect } from 'vitest';
import { DocenteXCiclo } from '../../entities/docente-x-ciclo';

describe('DocenteXCiclo entity', () => {
  const validProps = {
    userId: 'user-1',
    cycleId: 'cycle-uuid-1',
  };

  // F2-T1 / DC-S3: create generates a unique id; reconstruct preserves it
  it('create generates an id', () => {
    const d = DocenteXCiclo.create(validProps);
    expect(d.id).toBeTruthy();
    expect(typeof d.id).toBe('string');
  });

  it('two create() calls produce different ids', () => {
    const a = DocenteXCiclo.create(validProps);
    const b = DocenteXCiclo.create(validProps);
    expect(a.id).not.toBe(b.id);
  });

  it('reconstruct preserves the id', () => {
    const d = DocenteXCiclo.reconstruct({
      id: 'fixed-id',
      userId: 'user-1',
      cycleId: 'cycle-uuid-1',
      active: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    });
    expect(d.id).toBe('fixed-id');
  });

  // DC-R1: keyed by (userId, cycleId)
  it('exposes userId and cycleId', () => {
    const d = DocenteXCiclo.create({ userId: 'u-1', cycleId: 'c-1' });
    expect(d.userId).toBe('u-1');
    expect(d.cycleId).toBe('c-1');
  });

  // DC-R2: no persona fields stored on the entity
  it('has no persona fields (dni, firstName, lastName, title, phone)', () => {
    const d = DocenteXCiclo.create(validProps);
    expect((d as unknown as Record<string, unknown>)['dni']).toBeUndefined();
    expect((d as unknown as Record<string, unknown>)['firstName']).toBeUndefined();
    expect((d as unknown as Record<string, unknown>)['lastName']).toBeUndefined();
    expect((d as unknown as Record<string, unknown>)['title']).toBeUndefined();
    expect((d as unknown as Record<string, unknown>)['phone']).toBeUndefined();
  });

  // F2-T1 / DC-S3: active defaults to true on create
  it('active defaults to true', () => {
    const d = DocenteXCiclo.create(validProps);
    expect(d.active).toBe(true);
  });

  // DC-R4: cycle-scoped — cycleId is preserved
  it('preserves cycleId for historical scoping (DC-R4)', () => {
    const d = DocenteXCiclo.reconstruct({
      id: 'id-1',
      userId: 'u-2',
      cycleId: 'cycle-2024',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(d.cycleId).toBe('cycle-2024');
  });

  // F2-T5 / DC-R4 / DC-S8: deletedAt is optional
  it('deletedAt is undefined by default', () => {
    const d = DocenteXCiclo.create(validProps);
    expect(d.deletedAt).toBeUndefined();
  });

  it('reconstruct with deletedAt', () => {
    const deleted = new Date('2025-06-01');
    const d = DocenteXCiclo.reconstruct({
      id: 'id-del',
      userId: 'u-del',
      cycleId: 'c-del',
      active: false,
      deletedAt: deleted,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(d.active).toBe(false);
    expect(d.deletedAt).toBe(deleted);
  });

  // DC-S5 / DC-S6 / DC-S7: module check is NOT part of the entity (the entity
  // is just the record; module gates live in the application layer)
  // Verify entity does not carry module-check logic
  it('does not have a canEnterGrades method — module check is outside the entity', () => {
    const d = DocenteXCiclo.create(validProps);
    expect((d as unknown as Record<string, unknown>)['canEnterGrades']).toBeUndefined();
  });
});
