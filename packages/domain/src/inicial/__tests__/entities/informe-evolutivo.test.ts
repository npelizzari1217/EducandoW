import { describe, it, expect } from 'vitest';
import { InformeEvolutivo } from '../../entities/informe-evolutivo';

describe('InformeEvolutivo', () => {
  const validInput = {
    studentId: 'student-1',
    salaId: 'sala-1',
    periodo: '1T',
    fecha: new Date('2026-04-15'),
    observacionesGenerales: 'Buen progreso',
    areas: [
      {
        id: 'area-1',
        informeId: '',
        area: 'Motricidad fina',
        observacion: 'Logra recortar con precisión',
        valoracion: 'EN_PROCESO',
      },
    ],
  };

  // ── Spec Scenario: Teacher creates report ────────────────────

  describe('create()', () => {
    it('creates an informe evolutivo with valid data', () => {
      const r = InformeEvolutivo.create(validInput);
      expect(r.isOk()).toBe(true);

      const informe = r.unwrap();
      expect(informe.id.get()).toBeTruthy();
      expect(informe.studentId).toBe('student-1');
      expect(informe.salaId).toBe('sala-1');
      expect(informe.periodo.get()).toBe('1T');
      expect(informe.fecha).toEqual(new Date('2026-04-15'));
      expect(informe.observacionesGenerales).toBe('Buen progreso');
      expect(informe.areas).toHaveLength(1);
      expect(informe.areas[0].area).toBe('Motricidad fina');
    });

    it('creates with periodo 2T', () => {
      const r = InformeEvolutivo.create({ ...validInput, periodo: '2T' });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().periodo.get()).toBe('2T');
    });

    it('creates with periodo 3T', () => {
      const r = InformeEvolutivo.create({ ...validInput, periodo: '3T' });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().periodo.get()).toBe('3T');
    });

    it('defaults areas to empty array', () => {
      const r = InformeEvolutivo.create({
        ...validInput,
        areas: undefined,
      });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().areas).toEqual([]);
    });

    it('defaults observacionesGenerales to undefined', () => {
      const r = InformeEvolutivo.create({
        ...validInput,
        observacionesGenerales: undefined,
      });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().observacionesGenerales).toBeUndefined();
    });

    it('areas returns a copy to preserve immutability', () => {
      const r = InformeEvolutivo.create(validInput);
      const areas = r.unwrap().areas;
      areas.push({ id: 'area-2', informeId: '', area: 'Lenguaje', observacion: 'x', valoracion: 'LOGRADO' });
      expect(r.unwrap().areas).toHaveLength(1);
    });
  });

  describe('validation', () => {
    it('rejects missing studentId', () => {
      const r = InformeEvolutivo.create({ ...validInput, studentId: '' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Student ID is required');
    });

    it('rejects missing salaId', () => {
      const r = InformeEvolutivo.create({ ...validInput, salaId: '' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Sala ID is required');
    });

    it('rejects invalid periodo', () => {
      const r = InformeEvolutivo.create({ ...validInput, periodo: '4T' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Periodo');
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs preserving all fields', () => {
      const created = InformeEvolutivo.create(validInput).unwrap();
      const recon = InformeEvolutivo.reconstruct({
        id: created.id,
        studentId: created.studentId,
        salaId: created.salaId,
        periodo: created.periodo,
        fecha: created.fecha,
        observacionesGenerales: created.observacionesGenerales,
        areas: created.areas,
      });
      expect(recon.studentId).toBe('student-1');
      expect(recon.periodo.get()).toBe('1T');
    });
  });
});
