import { describe, it, expect } from 'vitest';
import {
  AttendanceBehavior,
  AttendanceBehaviorValue,
} from '../../value-objects/attendance-behavior';
import { ValidationError } from '../../../shared/errors/validation-error';

const ALL_VALUES = Object.values(AttendanceBehaviorValue);

describe('AttendanceBehavior', () => {
  describe('create()', () => {
    it('accepts a valid member and get() returns the value', () => {
      const r = AttendanceBehavior.create('AUSENTE_INJUSTIFICADO');
      expect(r.isOk()).toBe(true);
      expect(r.unwrap().get()).toBe(AttendanceBehaviorValue.AUSENTE_INJUSTIFICADO);
    });

    it('rejects an invalid value', () => {
      const r = AttendanceBehavior.create('INVALID');
      expect(r.isErr()).toBe(true);
      expect(r.unwrapErr()).toBeInstanceOf(ValidationError);
    });

    it('constructs all 7 members without cross-validation/uniqueness error', () => {
      for (const value of ALL_VALUES) {
        const r = AttendanceBehavior.create(value);
        expect(r.isOk()).toBe(true);
        expect(r.unwrap().get()).toBe(value);
      }
    });
  });

  describe('isEligible()', () => {
    it('is false only for NO_ELEGIBLE', () => {
      for (const value of ALL_VALUES) {
        const behavior = AttendanceBehavior.create(value).unwrap();
        const expected = value !== AttendanceBehaviorValue.NO_ELEGIBLE;
        expect(behavior.isEligible()).toBe(expected);
      }
    });
  });

  describe('isDiaHabil()', () => {
    it('is false for NO_ELEGIBLE and DIA_NO_HABIL; true for the other 5', () => {
      const noHabil = new Set([
        AttendanceBehaviorValue.NO_ELEGIBLE,
        AttendanceBehaviorValue.DIA_NO_HABIL,
      ]);
      for (const value of ALL_VALUES) {
        const behavior = AttendanceBehavior.create(value).unwrap();
        expect(behavior.isDiaHabil()).toBe(!noHabil.has(value));
      }
    });
  });

  describe('exclusive per-member predicates', () => {
    const predicates: Array<{
      name: string;
      call: (b: AttendanceBehavior) => boolean;
      own: AttendanceBehaviorValue;
    }> = [
      {
        name: 'isTardeJustificada',
        call: (b) => b.isTardeJustificada(),
        own: AttendanceBehaviorValue.TARDE_JUSTIFICADA,
      },
      {
        name: 'isTardeInjustificada',
        call: (b) => b.isTardeInjustificada(),
        own: AttendanceBehaviorValue.TARDE_INJUSTIFICADA,
      },
      {
        name: 'isAusenteJustificado',
        call: (b) => b.isAusenteJustificado(),
        own: AttendanceBehaviorValue.AUSENTE_JUSTIFICADO,
      },
      {
        name: 'isAusenteInjustificado',
        call: (b) => b.isAusenteInjustificado(),
        own: AttendanceBehaviorValue.AUSENTE_INJUSTIFICADO,
      },
      {
        name: 'isNoComputa',
        call: (b) => b.isNoComputa(),
        own: AttendanceBehaviorValue.NO_COMPUTA,
      },
    ];

    for (const { name, call, own } of predicates) {
      it(`${name}() is true only for its own member, false for the other 6`, () => {
        for (const value of ALL_VALUES) {
          const behavior = AttendanceBehavior.create(value).unwrap();
          expect(call(behavior)).toBe(value === own);
        }
      });
    }
  });
});
