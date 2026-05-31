import { describe, it, expect } from 'vitest';
import { Curso } from '../../entities/curso';
import { Orientacion } from '../../value-objects/orientacion';

describe('Curso', () => {
  // ── Spec Scenario: Create curso with orientation ─────────────

  describe('create()', () => {
    it('creates a curso with orientation NATURALES', () => {
      const curso = Curso.create({
        year: 5,
        division: 'A',
        orientacion: Orientacion.create('NATURALES')!,
        academicYear: '2026',
      });

      expect(curso.id.get()).toBeTruthy();
      expect(curso.year).toBe(5);
      expect(curso.division).toBe('A');
      expect(curso.orientacion!.get()).toBe('NATURALES');
      expect(curso.academicYear).toBe('2026');
      expect(curso.active).toBe(true);
    });

    it('creates a curso without orientation (null)', () => {
      const curso = Curso.create({
        year: 1,
        division: 'B',
        academicYear: '2026',
      });
      expect(curso.orientacion).toBeUndefined();
      expect(curso.year).toBe(1);
      expect(curso.division).toBe('B');
    });

    it.each(['NATURALES', 'SOCIALES', 'ECONOMIA', 'ARTE'] as const)('creates with orientation %s', (o) => {
      const curso = Curso.create({
        year: 4,
        division: 'C',
        orientacion: Orientacion.reconstruct(o),
        academicYear: '2026',
      });
      expect(curso.orientacion!.get()).toBe(o);
    });

    it('creates with courseSectionId', () => {
      const curso = Curso.create({
        year: 3,
        division: 'A',
        courseSectionId: 'cs-sec-1',
        academicYear: '2026',
      });
      expect(curso.courseSectionId).toBe('cs-sec-1');
    });
  });

  describe('update()', () => {
    it('updates year', () => {
      const curso = Curso.create({ year: 1, division: 'A', academicYear: '2026' });
      curso.update({ year: 2 });
      expect(curso.year).toBe(2);
    });

    it('updates division', () => {
      const curso = Curso.create({ year: 1, division: 'A', academicYear: '2026' });
      curso.update({ division: 'B' });
      expect(curso.division).toBe('B');
    });

    it('updates orientacion', () => {
      const curso = Curso.create({ year: 1, division: 'A', academicYear: '2026' });
      const newOri = Orientacion.create('ARTE')!;
      curso.update({ orientacion: newOri });
      expect(curso.orientacion!.get()).toBe('ARTE');
    });

    it('updates academicYear', () => {
      const curso = Curso.create({ year: 1, division: 'A', academicYear: '2026' });
      curso.update({ academicYear: '2027' });
      expect(curso.academicYear).toBe('2027');
    });

    it('updates courseSectionId', () => {
      const curso = Curso.create({ year: 1, division: 'A', academicYear: '2026' });
      curso.update({ courseSectionId: 'cs-new' });
      expect(curso.courseSectionId).toBe('cs-new');
    });

    it('does not modify year when not provided', () => {
      const curso = Curso.create({ year: 3, division: 'A', academicYear: '2026' });
      curso.update({ division: 'B' });
      expect(curso.year).toBe(3);
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs with all fields', () => {
      const created = Curso.create({ year: 5, division: 'A', orientacion: Orientacion.reconstruct('NATURALES'), academicYear: '2026' });
      const recon = Curso.reconstruct({
        id: created.id,
        year: created.year,
        division: created.division,
        orientacion: created.orientacion,
        academicYear: created.academicYear,
        active: false,
        deletedAt: new Date('2026-05-01'),
      });
      expect(recon.year).toBe(5);
      expect(recon.active).toBe(false);
      expect(recon.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('softDelete()', () => {
    it('marks curso as inactive', () => {
      const curso = Curso.create({ year: 1, division: 'A', academicYear: '2026' });
      curso.softDelete();
      expect(curso.active).toBe(false);
      expect(curso.deletedAt).toBeInstanceOf(Date);
    });
  });
});
