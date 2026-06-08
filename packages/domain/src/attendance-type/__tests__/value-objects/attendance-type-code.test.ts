import { describe, it, expect } from 'vitest';
import { AttendanceTypeCode } from '../../value-objects/attendance-type-code';
import { ValidationError } from '../../../shared/errors/validation-error';

describe('AttendanceTypeCode', () => {
  describe('create()', () => {
    it('accepts a single uppercase character', () => {
      const r = AttendanceTypeCode.create('P');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('P');
    });

    it('accepts a 3-char code like SAB', () => {
      const r = AttendanceTypeCode.create('SAB');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('SAB');
    });

    it('accepts a 4-char code like ABCD', () => {
      const r = AttendanceTypeCode.create('ABCD');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('ABCD');
    });

    it('rejects a 5-char code (ABCDE)', () => {
      const r = AttendanceTypeCode.create('ABCDE');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr()).toBeInstanceOf(ValidationError);
      expect(r.unwrapErr().message).toContain('4');
    });

    it('rejects an empty string', () => {
      const r = AttendanceTypeCode.create('');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr()).toBeInstanceOf(ValidationError);
    });

    it('normalizes lowercase to uppercase', () => {
      const r = AttendanceTypeCode.create('ab');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('AB');
    });

    it('trims whitespace before validation', () => {
      const r = AttendanceTypeCode.create('  P  ');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe('P');
    });
  });

  describe('equals()', () => {
    it('equals same code', () => {
      const a = AttendanceTypeCode.create('P').unwrap();
      const b = AttendanceTypeCode.create('p').unwrap();
      expect(a.equals(b)).toBe(true);
    });

    it('does not equal different code', () => {
      const a = AttendanceTypeCode.create('P').unwrap();
      const b = AttendanceTypeCode.create('SAB').unwrap();
      expect(a.equals(b)).toBe(false);
    });
  });
});
