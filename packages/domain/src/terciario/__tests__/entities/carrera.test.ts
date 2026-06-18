import { describe, it, expect } from 'vitest';
import { Carrera } from '../../entities/carrera';
import { ValidationError } from '../../../shared/errors/validation-error';

describe('Carrera', () => {
  // ── Spec Scenario: Create career ─────────────────────────────

  describe('create()', () => {
    it('creates a carrera with valid data', () => {
      const carrera = Carrera.create({
        name: 'Profesorado de Matemática',
        titulo: 'Profesor de Educación Secundaria en Matemática',
        duracion: 4,
      });

      expect(carrera.id.get()).toBeTruthy();
      expect(carrera.name).toBe('Profesorado de Matemática');
      expect(carrera.titulo).toBe('Profesor de Educación Secundaria en Matemática');
      expect(carrera.duracion).toBe(4);
      expect(carrera.active).toBe(true);
      expect(carrera.resolucion).toBeUndefined();
      expect(carrera.deletedAt).toBeUndefined();
    });

    it('creates with optional resolucion', () => {
      const carrera = Carrera.create({
        name: 'Profesorado de Inglés',
        titulo: 'Profesor de Inglés',
        duracion: 4,
        resolucion: 'RES-123/20',
      });

      expect(carrera.resolucion).toBe('RES-123/20');
    });

    it('creates with 3 year duracion', () => {
      const carrera = Carrera.create({
        name: 'Tecnicatura en Desarrollo Web',
        titulo: 'Técnico Superior en Desarrollo Web',
        duracion: 3,
      });
      expect(carrera.duracion).toBe(3);
    });
  });

  describe('update()', () => {
    it('updates name', () => {
      const carrera = Carrera.create({
        name: 'Original',
        titulo: 'Título Original',
        duracion: 4,
      });
      carrera.update({ name: 'Actualizado' });
      expect(carrera.name).toBe('Actualizado');
    });

    it('updates titulo', () => {
      const carrera = Carrera.create({
        name: 'Carrera',
        titulo: 'Título Viejo',
        duracion: 4,
      });
      carrera.update({ titulo: 'Título Nuevo' });
      expect(carrera.titulo).toBe('Título Nuevo');
    });

    it('updates duracion', () => {
      const carrera = Carrera.create({
        name: 'Carrera',
        titulo: 'Título',
        duracion: 3,
      });
      carrera.update({ duracion: 5 });
      expect(carrera.duracion).toBe(5);
    });

    it('updates resolucion', () => {
      const carrera = Carrera.create({
        name: 'Carrera',
        titulo: 'Título',
        duracion: 4,
        resolucion: 'OLD-001',
      });
      carrera.update({ resolucion: 'NEW-002' });
      expect(carrera.resolucion).toBe('NEW-002');
    });

    it('partial update does not affect other fields', () => {
      const carrera = Carrera.create({
        name: 'Carrera Original',
        titulo: 'Título Original',
        duracion: 4,
      });
      carrera.update({ duracion: 5 });
      expect(carrera.name).toBe('Carrera Original');
      expect(carrera.titulo).toBe('Título Original');
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs preserving all fields', () => {
      const created = Carrera.create({ name: 'Carrera', titulo: 'Título', duracion: 4, resolucion: 'RES-001' });
      const recon = Carrera.reconstruct({
        id: created.id,
        name: created.name,
        titulo: created.titulo,
        duracion: created.duracion,
        resolucion: created.resolucion,
        active: false,
        deletedAt: new Date('2026-06-01'),
        llamadosVencimiento: 5,
      });
      expect(recon.name).toBe('Carrera');
      expect(recon.active).toBe(false);
      expect(recon.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('softDelete()', () => {
    it('marks carrera as inactive', () => {
      const carrera = Carrera.create({ name: 'X', titulo: 'Y', duracion: 3 });
      carrera.softDelete();
      expect(carrera.active).toBe(false);
      expect(carrera.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('llamadosVencimiento (FR-3.1–FR-3.5)', () => {
    it('create() without llamadosVencimiento → getter returns 5 (Scenario M)', () => {
      const carrera = Carrera.create({ name: 'X', titulo: 'Y', duracion: 3 });
      expect(carrera.llamadosVencimiento).toBe(5);
    });

    it('create({ llamadosVencimiento: 3 }) → getter returns 3 (FR-3.4)', () => {
      const carrera = Carrera.create({ name: 'X', titulo: 'Y', duracion: 3, llamadosVencimiento: 3 });
      expect(carrera.llamadosVencimiento).toBe(3);
    });

    it('create({ llamadosVencimiento: 0 }) → throws ValidationError (Scenario N, FR-3.5)', () => {
      expect(() => Carrera.create({ name: 'X', titulo: 'Y', duracion: 3, llamadosVencimiento: 0 }))
        .toThrow(ValidationError);
    });

    it('create({ llamadosVencimiento: -1 }) → throws ValidationError (FR-3.5)', () => {
      expect(() => Carrera.create({ name: 'X', titulo: 'Y', duracion: 3, llamadosVencimiento: -1 }))
        .toThrow(ValidationError);
    });

    it('reconstruct({ llamadosVencimiento: 7 }) → getter returns 7 (FR-3.3)', () => {
      const created = Carrera.create({ name: 'X', titulo: 'Y', duracion: 3 });
      const recon = Carrera.reconstruct({
        id: created.id,
        name: created.name,
        titulo: created.titulo,
        duracion: created.duracion,
        active: created.active,
        llamadosVencimiento: 7,
      });
      expect(recon.llamadosVencimiento).toBe(7);
    });

    it('reconstruct({ llamadosVencimiento: 0 }) → throws ValidationError (FR-3.5)', () => {
      const created = Carrera.create({ name: 'X', titulo: 'Y', duracion: 3 });
      expect(() => Carrera.reconstruct({
        id: created.id,
        name: created.name,
        titulo: created.titulo,
        duracion: created.duracion,
        active: created.active,
        llamadosVencimiento: 0,
      })).toThrow(ValidationError);
    });
  });
});
