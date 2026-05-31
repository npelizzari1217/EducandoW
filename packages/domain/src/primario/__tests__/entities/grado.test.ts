import { describe, it, expect } from 'vitest';
import { Grado } from '../../entities/grado';

describe('Grado', () => {
  const validInput = {
    courseSectionId: 'cs-1',
    grade: 3,
    division: 'A',
    academicYear: '2026',
  };

  // ── Spec Scenario: Create grado ──────────────────────────────

  describe('create()', () => {
    it('creates a grado with valid data', () => {
      const r = Grado.create(validInput);
      expect(r.isOk()).toBe(true);

      const grado = r.unwrap();
      expect(grado.id.get()).toBeTruthy();
      expect(grado.grade.value).toBe(3);
      expect(grado.division.value).toBe('A');
      expect(grado.academicYear).toBe('2026');
      expect(grado.active).toBe(true);
      expect(grado.courseSectionId).toBe('cs-1');
    });

    it.each([1, 2, 3, 4, 5, 6])('creates grado with grade %i', (g) => {
      const r = Grado.create({ ...validInput, grade: g });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().grade.value).toBe(g);
    });

    it.each(['A', 'B', 'C'])('creates grado with division %s', (d) => {
      const r = Grado.create({ ...validInput, division: d });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().division.value).toBe(d);
    });

    it('creates grado with optional teacherId', () => {
      const r = Grado.create({ ...validInput, teacherId: 'teacher-1' });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().teacherId).toBe('teacher-1');
    });

    it('creates grado without courseSectionId', () => {
      const r = Grado.create({ ...validInput, courseSectionId: undefined });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().courseSectionId).toBeUndefined();
    });
  });

  // ── Spec Scenario: Duplicate grado (VO equality) ─────────────

  describe('grade equality', () => {
    it('two grados with same grade and division have equal VOs', () => {
      const g1 = Grado.create(validInput).unwrap();
      const g2 = Grado.create(validInput).unwrap();

      expect(g1.grade.equals(g2.grade)).toBe(true);
      expect(g1.division.equals(g2.division)).toBe(true);
    });

    it('two grados with different grade have unequal VOs', () => {
      const g1 = Grado.create(validInput).unwrap();
      const g2 = Grado.create({ ...validInput, grade: 5 }).unwrap();

      expect(g1.grade.equals(g2.grade)).toBe(false);
    });

    it('two grados with different division have unequal VOs', () => {
      const g1 = Grado.create(validInput).unwrap();
      const g2 = Grado.create({ ...validInput, division: 'C' }).unwrap();

      expect(g1.division.equals(g2.division)).toBe(false);
    });
  });

  describe('validation', () => {
    it('rejects grade 0', () => {
      const r = Grado.create({ ...validInput, grade: 0 });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Grado inválido');
    });

    it('rejects grade 7', () => {
      const r = Grado.create({ ...validInput, grade: 7 });
      expect(r.isErr()).toBe(true);
    });

    it('rejects invalid division', () => {
      const r = Grado.create({ ...validInput, division: 'D' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('División inválida');
    });

    it('rejects empty academic year', () => {
      const r = Grado.create({ ...validInput, academicYear: '' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('año lectivo es requerido');
    });
  });

  describe('update()', () => {
    it('updates allowed fields', () => {
      const grado = Grado.create(validInput).unwrap();
      grado.update({ teacherId: 'new-teacher', academicYear: '2027' });
      expect(grado.teacherId).toBe('new-teacher');
      expect(grado.academicYear).toBe('2027');
    });

    it('does not modify grade or division on update', () => {
      const grado = Grado.create(validInput).unwrap();
      grado.update({ courseSectionId: 'cs-2' });
      expect(grado.grade.value).toBe(3);
      expect(grado.division.value).toBe('A');
      expect(grado.courseSectionId).toBe('cs-2');
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs preserving all fields', () => {
      const created = Grado.create(validInput).unwrap();
      const recon = Grado.reconstruct({
        id: created.id,
        courseSectionId: created.courseSectionId,
        grade: created.grade,
        division: created.division,
        academicYear: created.academicYear,
        active: false,
        deletedAt: new Date('2026-01-01'),
      });
      expect(recon.grade.value).toBe(3);
      expect(recon.active).toBe(false);
      expect(recon.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('softDelete()', () => {
    it('marks grado as inactive', () => {
      const grado = Grado.create(validInput).unwrap();
      grado.softDelete();
      expect(grado.active).toBe(false);
      expect(grado.deletedAt).toBeInstanceOf(Date);
    });
  });
});
