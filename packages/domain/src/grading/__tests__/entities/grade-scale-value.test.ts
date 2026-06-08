import { describe, it, expect } from 'vitest';
import { GradeScaleValue } from '../../entities/grade-scale';
import { InvalidInternalStatusError } from '../../errors/grade-scale.errors';
import { ValidationError } from '../../../shared/errors/validation-error';

describe('GradeScaleValue', () => {
  const validInput = {
    scaleId: 'scale-1',
    code: 'MB',
    label: 'Muy Bueno',
    internalStatus: 'APROBADO' as const,
    sortOrder: 1,
  };

  describe('create()', () => {
    it('creates a valid value with APROBADO', () => {
      const v = GradeScaleValue.create(validInput);
      expect(v.scaleId).toBe('scale-1');
      expect(v.code).toBe('MB');
      expect(v.label).toBe('Muy Bueno');
      expect(v.internalStatus).toBe('APROBADO');
      expect(v.sortOrder).toBe(1);
      expect(v.active).toBe(true);
    });

    it('throws InvalidInternalStatusError for invalid internalStatus', () => {
      expect(() =>
        GradeScaleValue.create({ ...validInput, internalStatus: 'EXCELENTE' as any })
      ).toThrow(InvalidInternalStatusError);
    });

    it('throws ValidationError for empty code', () => {
      expect(() =>
        GradeScaleValue.create({ ...validInput, code: '' })
      ).toThrow(ValidationError);
    });

    it('throws ValidationError for whitespace-only code', () => {
      expect(() =>
        GradeScaleValue.create({ ...validInput, code: '   ' })
      ).toThrow(ValidationError);
    });

    it('accepts sortOrder = 0', () => {
      expect(() =>
        GradeScaleValue.create({ ...validInput, sortOrder: 0 })
      ).not.toThrow();
    });

    it('throws ValidationError for negative sortOrder', () => {
      expect(() =>
        GradeScaleValue.create({ ...validInput, sortOrder: -1 })
      ).toThrow(ValidationError);
    });
  });

  describe('softDelete()', () => {
    it('marks deletedAt and sets active to false', () => {
      const v = GradeScaleValue.create(validInput);
      expect(v.active).toBe(true);
      v.softDelete();
      expect(v.active).toBe(false);
      expect(v.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('reconstruct()', () => {
    it('preserves all fields', () => {
      const v = GradeScaleValue.reconstruct({
        id: 'val-1',
        scaleId: 'scale-1',
        code: '10',
        label: 'Excelente',
        internalStatus: 'APROBADO',
        sortOrder: 10,
        active: true,
        deletedAt: null,
      });
      expect(v.id).toBe('val-1');
      expect(v.code).toBe('10');
      expect(v.internalStatus).toBe('APROBADO');
    });
  });
});
