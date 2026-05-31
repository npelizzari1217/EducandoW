import { describe, it, expect } from 'vitest';
import { Sala } from '../../entities/sala';

describe('Sala', () => {
  const validInput = {
    name: 'Sala Azul',
    ageGroup: 4,
    turno: 'MAÑANA',
    capacity: 25,
    academicYear: '2026',
  };

  // ── Spec Scenario: Create sala with valid data ───────────────

  describe('create()', () => {
    it('creates a sala with valid data', () => {
      const r = Sala.create(validInput);
      expect(r.isOk()).toBe(true);

      const sala = r.unwrap();
      expect(sala.id.get()).toBeTruthy();
      expect(sala.name).toBe('Sala Azul');
      expect(sala.ageGroup.get()).toBe(4);
      expect(sala.turno.get()).toBe('MAÑANA');
      expect(sala.capacity).toBe(25);
      expect(sala.academicYear).toBe('2026');
      expect(sala.active).toBe(true);
      expect(sala.teacherId).toBeUndefined();
    });

    it('trims name whitespace', () => {
      const r = Sala.create({ ...validInput, name: '  Sala Verde  ' });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().name).toBe('Sala Verde');
    });

    it('creates sala with optional teacherId', () => {
      const r = Sala.create({ ...validInput, teacherId: 'teacher-1' });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().teacherId).toBe('teacher-1');
    });

    it('creates sala with turno TARDE', () => {
      const r = Sala.create({ ...validInput, turno: 'TARDE' });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().turno.get()).toBe('TARDE');
    });

    it('creates sala with age group 3', () => {
      const r = Sala.create({ ...validInput, ageGroup: 3 });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().ageGroup.get()).toBe(3);
    });

    it('creates sala with age group 5', () => {
      const r = Sala.create({ ...validInput, ageGroup: 5 });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().ageGroup.get()).toBe(5);
    });

    it('creates sala with capacity boundary (1)', () => {
      const r = Sala.create({ ...validInput, capacity: 1 });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().capacity).toBe(1);
    });

    it('creates sala with capacity boundary (50)', () => {
      const r = Sala.create({ ...validInput, capacity: 50 });
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().capacity).toBe(50);
    });
  });

  // ── Spec Scenario: Invalid age group rejected ────────────────

  describe('validation failures', () => {
    it('rejects age group 6', () => {
      const r = Sala.create({ ...validInput, ageGroup: 6 });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('AgeGroup');
    });

    it('rejects empty name', () => {
      const r = Sala.create({ ...validInput, name: '' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('name cannot be empty');
    });

    it('rejects whitespace-only name', () => {
      const r = Sala.create({ ...validInput, name: '   ' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('name cannot be empty');
    });

    it('rejects name over 100 characters', () => {
      const r = Sala.create({ ...validInput, name: 'A'.repeat(101) });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('cannot exceed 100');
    });

    it('rejects capacity 0', () => {
      const r = Sala.create({ ...validInput, capacity: 0 });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('capacity must be greater than 0');
    });

    it('rejects negative capacity', () => {
      const r = Sala.create({ ...validInput, capacity: -5 });
      expect(r.isErr()).toBe(true);
    });

    it('rejects capacity over 50', () => {
      const r = Sala.create({ ...validInput, capacity: 51 });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('capacity cannot exceed 50');
    });

    it('rejects invalid academic year format', () => {
      const r = Sala.create({ ...validInput, academicYear: '26' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('YYYY format');
    });

    it('rejects invalid turno', () => {
      const r = Sala.create({ ...validInput, turno: 'NOCHE' });
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr().message).toContain('Turno');
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs a sala preserving all fields', () => {
      const r = Sala.create(validInput);
      const created = r.unwrap();
      const reconstructed = Sala.reconstruct({
        id: created.id,
        name: created.name,
        ageGroup: created.ageGroup,
        turno: created.turno,
        capacity: created.capacity,
        academicYear: created.academicYear,
        active: false,
        deletedAt: new Date('2026-06-01'),
      });
      expect(reconstructed.active).toBe(false);
      expect(reconstructed.deletedAt).toBeInstanceOf(Date);
      expect(reconstructed.name).toBe('Sala Azul');
    });
  });

  describe('softDelete()', () => {
    it('marks sala as inactive and sets deletedAt', () => {
      const sala = Sala.create(validInput).unwrap();
      expect(sala.active).toBe(true);
      expect(sala.deletedAt).toBeUndefined();

      sala.softDelete();
      expect(sala.active).toBe(false);
      expect(sala.deletedAt).toBeInstanceOf(Date);
    });
  });
});
