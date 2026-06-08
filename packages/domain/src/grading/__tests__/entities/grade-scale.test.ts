import { describe, it, expect } from 'vitest';
import { GradeScale } from '../../entities/grade-scale';
import { ValidationError } from '../../../shared/errors/validation-error';

describe('GradeScale', () => {
  const validInput = {
    name: 'Numérica 1-10',
    level: 2,
    modality: 0,
  };

  describe('create()', () => {
    it('creates a valid scale', () => {
      const scale = GradeScale.create(validInput);
      expect(scale.name).toBe('Numérica 1-10');
      expect(scale.level).toBe(2);
      expect(scale.modality).toBe(0);
      expect(scale.active).toBe(true);
      expect(scale.deletedAt).toBeNull();
      expect(scale.id).toBeTruthy();
    });

    it('throws ValidationError when name is empty', () => {
      expect(() => GradeScale.create({ ...validInput, name: '' })).toThrow(ValidationError);
    });

    it('throws ValidationError when level is out of range (5)', () => {
      expect(() => GradeScale.create({ ...validInput, level: 5 })).toThrow(ValidationError);
    });

    it('throws ValidationError when level is 0', () => {
      expect(() => GradeScale.create({ ...validInput, level: 0 })).toThrow(ValidationError);
    });

    it('accepts all valid levels 1-4', () => {
      for (const level of [1, 2, 3, 4]) {
        expect(() => GradeScale.create({ ...validInput, level })).not.toThrow();
      }
    });
  });

  describe('softDelete()', () => {
    it('marks deletedAt and sets active to false', () => {
      const scale = GradeScale.create(validInput);
      expect(scale.active).toBe(true);
      scale.softDelete();
      expect(scale.active).toBe(false);
      expect(scale.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('reconstruct()', () => {
    it('preserves all provided fields', () => {
      const deletedAt = new Date('2025-01-01');
      const scale = GradeScale.reconstruct({
        id: 'scale-1',
        name: 'Cualitativa',
        level: 1,
        modality: 0,
        active: false,
        deletedAt,
        values: [],
      });
      expect(scale.id).toBe('scale-1');
      expect(scale.name).toBe('Cualitativa');
      expect(scale.level).toBe(1);
      expect(scale.active).toBe(false);
      expect(scale.deletedAt).toBe(deletedAt);
    });
  });
});
