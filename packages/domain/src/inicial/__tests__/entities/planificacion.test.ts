import { describe, it, expect } from 'vitest';
import { Planificacion } from '../../entities/planificacion';

describe('Planificacion', () => {
  const validInput = {
    salaId: 'sala-1',
    semana: 12,
    academicYear: '2026',
    secuencias: [
      {
        id: 'seq-1',
        planificacionId: '',
        nombre: 'Secuencia de colores',
        area: 'Arte',
        actividades: ['Pintar', 'Dibujar'],
        recursos: ['Pinceles', 'Temperas'],
      },
    ],
  };

  // ── Spec Scenario: Create weekly planning ────────────────────

  describe('create()', () => {
    it('creates a planificacion with valid data', () => {
      const r = Planificacion.create(validInput);
      expect(r.isOk()).toBe(true);

      const plan = r.unwrap();
      expect(plan.id.get()).toBeTruthy();
      expect(plan.salaId).toBe('sala-1');
      expect(plan.semana).toBe(12);
      expect(plan.academicYear).toBe('2026');
      expect(plan.active).toBe(true);
      expect(plan.secuencias).toHaveLength(1);
      expect(plan.secuencias[0].area).toBe('Arte');
    });

    it('creates with semana boundary (1)', () => {
      const r = Planificacion.create({ ...validInput, semana: 1 });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().semana).toBe(1);
    });

    it('creates with semana boundary (40)', () => {
      const r = Planificacion.create({ ...validInput, semana: 40 });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().semana).toBe(40);
    });

    it('defaults secuencias to empty array', () => {
      const r = Planificacion.create({
        ...validInput,
        secuencias: undefined,
      });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().secuencias).toEqual([]);
    });

    it('secuencias returns a copy for immutability', () => {
      const r = Planificacion.create(validInput);
      const seqs = r.unwrap().secuencias;
      seqs.push({ id: 'seq-2', planificacionId: '', nombre: 'x', area: 'y', actividades: [], recursos: [] });
      expect(r.unwrap().secuencias).toHaveLength(1);
    });
  });

  describe('validation', () => {
    it('rejects semana 0', () => {
      const r = Planificacion.create({ ...validInput, semana: 0 });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('between 1 and 40');
    });

    it('rejects semana 41', () => {
      const r = Planificacion.create({ ...validInput, semana: 41 });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('between 1 and 40');
    });

    it('rejects negative semana', () => {
      const r = Planificacion.create({ ...validInput, semana: -3 });
      expect(r.isErr()).toBe(true);
    });

    it('rejects missing salaId', () => {
      const r = Planificacion.create({ ...validInput, salaId: '' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Sala ID is required');
    });

    it('rejects invalid academic year', () => {
      const r = Planificacion.create({ ...validInput, academicYear: '202' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('YYYY');
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs preserving all fields', () => {
      const created = Planificacion.create(validInput).unwrap();
      const recon = Planificacion.reconstruct({
        id: created.id,
        salaId: created.salaId,
        semana: created.semana,
        academicYear: created.academicYear,
        active: false,
        deletedAt: new Date('2026-03-01'),
        secuencias: created.secuencias,
      });
      expect(recon.salaId).toBe('sala-1');
      expect(recon.active).toBe(false);
      expect(recon.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('softDelete()', () => {
    it('marks planificacion as inactive and sets deletedAt', () => {
      const plan = Planificacion.create(validInput).unwrap();
      plan.softDelete();
      expect(plan.active).toBe(false);
      expect(plan.deletedAt).toBeInstanceOf(Date);
    });
  });
});
