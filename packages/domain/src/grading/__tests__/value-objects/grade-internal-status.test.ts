import { describe, it, expect } from 'vitest';
import { GradeInternalStatus } from '../../value-objects/grade-internal-status';
import { InvalidInternalStatusError } from '../../errors/grade-scale.errors';

describe('GradeInternalStatus', () => {
  describe('create()', () => {
    it('accepts APROBADO', () => {
      const r = GradeInternalStatus.create('APROBADO');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('APROBADO');
    });

    it('accepts NO_APROBADO', () => {
      const r = GradeInternalStatus.create('NO_APROBADO');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('NO_APROBADO');
    });

    it('accepts EN_PROCESO', () => {
      const r = GradeInternalStatus.create('EN_PROCESO');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('EN_PROCESO');
    });

    it('accepts LIBRE', () => {
      const r = GradeInternalStatus.create('LIBRE');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('LIBRE');
    });

    it('rejects value outside the fixed enum (EXCELENTE)', () => {
      const r = GradeInternalStatus.create('EXCELENTE');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr()).toBeInstanceOf(InvalidInternalStatusError);
    });

    it('rejects empty string', () => {
      const r = GradeInternalStatus.create('');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr()).toBeInstanceOf(InvalidInternalStatusError);
    });
  });
});
