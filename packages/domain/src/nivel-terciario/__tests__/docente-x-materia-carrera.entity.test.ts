import { describe, it, expect } from 'vitest';
import { DocenteXMateriaCarrera } from '../docente-x-materia-carrera.entity';

describe('DocenteXMateriaCarrera entity', () => {
  const baseInput = {
    userId: 'user-1',
    materiaCarreraId: 'materia-1',
    anioAcademico: '2026',
  };

  describe('create()', () => {
    it('builds entity with active = true by default', () => {
      const entity = DocenteXMateriaCarrera.create(baseInput);
      expect(entity.active).toBe(true);
      expect(entity.userId).toBe('user-1');
      expect(entity.materiaCarreraId).toBe('materia-1');
      expect(entity.anioAcademico).toBe('2026');
      expect(entity.id).toBeTruthy();
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('unassign()', () => {
    it('sets active = false and bumps updatedAt', async () => {
      const entity = DocenteXMateriaCarrera.create(baseInput);
      const before = entity.updatedAt;
      await new Promise(r => setTimeout(r, 2)); // ensure time advances
      entity.unassign();
      expect(entity.active).toBe(false);
      expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('reactivate()', () => {
    it('sets active = true (used after soft-unassign)', () => {
      const entity = DocenteXMateriaCarrera.create(baseInput);
      entity.unassign();
      expect(entity.active).toBe(false);
      entity.reactivate();
      expect(entity.active).toBe(true);
    });
  });

  describe('reconstruct()', () => {
    it('round-trips all fields', () => {
      const now = new Date();
      const entity = DocenteXMateriaCarrera.reconstruct({
        id: 'id-123',
        userId: 'user-2',
        materiaCarreraId: 'materia-2',
        anioAcademico: '2025',
        active: false,
        createdAt: now,
        updatedAt: now,
      });
      expect(entity.id).toBe('id-123');
      expect(entity.userId).toBe('user-2');
      expect(entity.materiaCarreraId).toBe('materia-2');
      expect(entity.anioAcademico).toBe('2025');
      expect(entity.active).toBe(false);
      expect(entity.createdAt).toBe(now);
      expect(entity.updatedAt).toBe(now);
    });
  });

  describe('equality invariant', () => {
    it('same (userId, materiaCarreraId, anioAcademico) produces distinct objects if ids differ (co-teaching)', () => {
      const e1 = DocenteXMateriaCarrera.create(baseInput);
      const e2 = DocenteXMateriaCarrera.create(baseInput);
      expect(e1.id).not.toBe(e2.id);
      expect(e1.userId).toBe(e2.userId);
      expect(e1.materiaCarreraId).toBe(e2.materiaCarreraId);
      expect(e1.anioAcademico).toBe(e2.anioAcademico);
    });
  });
});
