import { describe, it, expect } from 'vitest';
import { AttendanceType } from '../../entities/attendance-type';
import { AttendanceTypeCode } from '../../value-objects/attendance-type-code';
import {
  AttendanceBehavior,
  AttendanceBehaviorValue,
} from '../../value-objects/attendance-behavior';
import { SystemAttendanceTypeError } from '../../errors/system-attendance-type-error';
import { ValidationError } from '../../../shared/errors/validation-error';

function validCode(s: string): AttendanceTypeCode {
  return AttendanceTypeCode.create(s).unwrap();
}

function behavior(value: AttendanceBehaviorValue): AttendanceBehavior {
  return AttendanceBehavior.create(value).unwrap();
}

const ALL_BEHAVIOR_VALUES = Object.values(AttendanceBehaviorValue);

describe('AttendanceType', () => {
  const baseInput = {
    code: 'T',
    description: 'Tardanza',
    absenceValue: 0.5,
    level: 2,
    behavior: AttendanceBehaviorValue.TARDE_JUSTIFICADA,
  };

  describe('create()', () => {
    it('creates a valid AttendanceType with isSystem = false by default', () => {
      const at = AttendanceType.create(baseInput);
      expect(at.isSystem).toBe(false);
      expect(at.active).toBe(true);
      expect(at.code.get()).toBe('T');
      expect(at.description).toBe('Tardanza');
      expect(at.absenceValue).toBe(0.5);
      expect(at.level).toBe(2);
      expect(at.behavior.get()).toBe(AttendanceBehaviorValue.TARDE_JUSTIFICADA);
      expect(at.assignable).toBe(true);
      expect(at.id).toBeTruthy();
    });

    it('generates a unique id for each creation', () => {
      const a = AttendanceType.create(baseInput);
      const b = AttendanceType.create(baseInput);
      expect(a.id).not.toBe(b.id);
    });

    it('rejects code longer than 4 characters', () => {
      expect(() =>
        AttendanceType.create({ ...baseInput, code: 'ABCDE' }),
      ).toThrow(ValidationError);
    });

    it('rejects empty code', () => {
      expect(() =>
        AttendanceType.create({ ...baseInput, code: '' }),
      ).toThrow(ValidationError);
    });

    it('rejects absenceValue < 0', () => {
      expect(() =>
        AttendanceType.create({ ...baseInput, absenceValue: -1 }),
      ).toThrow(ValidationError);
    });

    it('rejects level = 9 (ADMINISTRACION)', () => {
      expect(() =>
        AttendanceType.create({ ...baseInput, level: 9 }),
      ).toThrow(ValidationError);
    });

    it('rejects level = 0 (out of range)', () => {
      expect(() =>
        AttendanceType.create({ ...baseInput, level: 0 }),
      ).toThrow(ValidationError);
    });

    it('rejects level = 5 (out of range)', () => {
      expect(() =>
        AttendanceType.create({ ...baseInput, level: 5 }),
      ).toThrow(ValidationError);
    });

    it('accepts all valid pedagogical levels (1-4)', () => {
      for (const level of [1, 2, 3, 4]) {
        expect(() => AttendanceType.create({ ...baseInput, level })).not.toThrow();
      }
    });

    it('derives assignable from behavior.isEligible() for every behavior value (ADR-03)', () => {
      for (const value of ALL_BEHAVIOR_VALUES) {
        const at = AttendanceType.create({ ...baseInput, behavior: value });
        expect(at.assignable).toBe(at.behavior.isEligible());
        expect(at.assignable).toBe(value !== AttendanceBehaviorValue.NO_ELEGIBLE);
      }
    });
  });

  describe('assertMutable()', () => {
    it('does NOT throw when isSystem = false', () => {
      const at = AttendanceType.create(baseInput);
      expect(() => at.assertMutable()).not.toThrow();
    });

    it('throws SystemAttendanceTypeError when isSystem = true', () => {
      const at = AttendanceType.reconstruct({
        id: 'sys-id-1',
        code: validCode('P'),
        description: 'Presente',
        absenceValue: 0,
        level: 2,
        behavior: behavior(AttendanceBehaviorValue.NO_COMPUTA),
        isSystem: true,
        active: true,
      });
      expect(() => at.assertMutable()).toThrow(SystemAttendanceTypeError);
    });

    it('SystemAttendanceTypeError has correct code', () => {
      const at = AttendanceType.reconstruct({
        id: 'sys-id-2',
        code: validCode('SAB'),
        description: 'Sábado',
        absenceValue: 0,
        level: 2,
        behavior: behavior(AttendanceBehaviorValue.NO_ELEGIBLE),
        isSystem: true,
        active: true,
      });
      try {
        at.assertMutable();
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(SystemAttendanceTypeError);
        expect((e as SystemAttendanceTypeError).code).toBe('ATTENDANCE_TYPE_SYSTEM_PROTECTED');
      }
    });

    it('throws regardless of the behavior value attempted on a system-locked entity', () => {
      for (const value of ALL_BEHAVIOR_VALUES) {
        const at = AttendanceType.reconstruct({
          id: 'sys-id-locked',
          code: validCode('P'),
          description: 'Presente',
          absenceValue: 0,
          level: 2,
          behavior: behavior(value),
          isSystem: true,
          active: true,
        });
        expect(() => at.assertMutable()).toThrow(SystemAttendanceTypeError);
      }
    });
  });

  describe('reconstruct()', () => {
    it('restores all fields including arbitrary id and rebuilds the behavior VO', () => {
      const arbitraryId = 'arbitrary-uuid-123';
      const code = validCode('DOM');
      const at = AttendanceType.reconstruct({
        id: arbitraryId,
        code,
        description: 'Domingo',
        absenceValue: 0,
        level: 3,
        behavior: behavior(AttendanceBehaviorValue.NO_ELEGIBLE),
        isSystem: true,
        active: true,
        deletedAt: new Date('2026-01-01'),
      });

      expect(at.id).toBe(arbitraryId);
      expect(at.code.get()).toBe('DOM');
      expect(at.description).toBe('Domingo');
      expect(at.absenceValue).toBe(0);
      expect(at.level).toBe(3);
      expect(at.behavior.get()).toBe(AttendanceBehaviorValue.NO_ELEGIBLE);
      expect(at.assignable).toBe(false);
      expect(at.isSystem).toBe(true);
      expect(at.active).toBe(true);
      expect(at.deletedAt).toBeInstanceOf(Date);
    });

    it('preserves fractional absenceValue (0.25, 0.75) independent of the chosen behavior', () => {
      for (const [absenceValue, value] of [
        [0.25, AttendanceBehaviorValue.TARDE_JUSTIFICADA],
        [0.75, AttendanceBehaviorValue.AUSENTE_JUSTIFICADO],
      ] as const) {
        const at = AttendanceType.reconstruct({
          id: 'frac-id',
          code: validCode('X'),
          description: 'Fraccional',
          absenceValue,
          level: 2,
          behavior: behavior(value),
          isSystem: false,
          active: true,
        });
        expect(at.absenceValue).toBe(absenceValue);
        expect(at.behavior.get()).toBe(value);
      }
    });
  });
});
