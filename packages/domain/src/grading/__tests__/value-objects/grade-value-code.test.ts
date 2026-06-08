import { describe, it, expect } from 'vitest';
import { GradeValueCode } from '../../value-objects/grade-value-code';
import { ValidationError } from '../../../shared/errors/validation-error';

describe('GradeValueCode', () => {
  describe('create()', () => {
    it('accepts numeric string "10"', () => {
      const r = GradeValueCode.create('10');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('10');
    });

    it('accepts alphanumeric with symbols "A+"', () => {
      const r = GradeValueCode.create('A+');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('A+');
    });

    it('accepts word "Logrado"', () => {
      const r = GradeValueCode.create('Logrado');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('Logrado');
    });

    it('rejects empty string', () => {
      const r = GradeValueCode.create('');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr()).toBeInstanceOf(ValidationError);
    });

    it('rejects whitespace-only string', () => {
      const r = GradeValueCode.create('   ');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr()).toBeInstanceOf(ValidationError);
    });
  });
});
