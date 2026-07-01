/**
 * asistencia-totals unit tests — Strict TDD
 * Satisfies: REQ-P2-6, REQ-P2-7 / Scenarios P2-3..P2-11 / AC-P2-5..17
 */
import { describe, it, expect } from 'vitest';
import { computeStudentTotals, computeDiasHabiles } from '../asistencia-totals';
import { AttendanceBehaviorValue } from '../../../attendance-type/value-objects/attendance-behavior';

type CatalogEntry = { behavior: AttendanceBehaviorValue; absenceValue: number };

function catalog(entries: Record<string, CatalogEntry>): Map<string, CatalogEntry> {
  return new Map(Object.entries(entries));
}

describe('computeStudentTotals', () => {
  it('P2-3: days with behavior 6 (0.5+0.5) and behavior 5 (1) → tardesJust=1.0, tardesInj=1.0, totalTardes=2.0', () => {
    const cat = catalog({
      TJ: { behavior: AttendanceBehaviorValue.TARDE_JUSTIFICADA, absenceValue: 0.5 },
      TI: { behavior: AttendanceBehaviorValue.TARDE_INJUSTIFICADA, absenceValue: 1 },
    });
    const days = { '1': 'TJ', '2': 'TJ', '3': 'TI' };

    const totals = computeStudentTotals(days, cat);

    expect(totals.tardesJust).toBe(1.0);
    expect(totals.tardesInj).toBe(1.0);
    expect(totals.totalTardes).toBe(2.0);
  });

  it('P2-4: days with behavior 1 (1) and behavior 2 (1+0.5) → ausJust=1.5, ausInj=1.0, ausTotal=2.5', () => {
    const cat = catalog({
      AI: { behavior: AttendanceBehaviorValue.AUSENTE_INJUSTIFICADO, absenceValue: 1 },
      AJ: { behavior: AttendanceBehaviorValue.AUSENTE_JUSTIFICADO, absenceValue: 1 },
      AJ2: { behavior: AttendanceBehaviorValue.AUSENTE_JUSTIFICADO, absenceValue: 0.5 },
    });
    const days = { '1': 'AI', '2': 'AJ', '3': 'AJ2' };

    const totals = computeStudentTotals(days, cat);

    expect(totals.ausJust).toBe(1.5);
    expect(totals.ausInj).toBe(1.0);
    expect(totals.ausTotal).toBe(2.5);
  });

  it('P2-8: fractional absenceValue 0.25 + 0.75 both behavior 6 → tardesJust=1.00', () => {
    const cat = catalog({
      TJ1: { behavior: AttendanceBehaviorValue.TARDE_JUSTIFICADA, absenceValue: 0.25 },
      TJ2: { behavior: AttendanceBehaviorValue.TARDE_JUSTIFICADA, absenceValue: 0.75 },
    });
    const days = { '1': 'TJ1', '2': 'TJ2' };

    const totals = computeStudentTotals(days, cat);

    expect(totals.tardesJust).toBe(1.0);
  });

  it('P2-9: student with no marks (empty days) → all six totals = 0, no throw', () => {
    const cat = catalog({
      AI: { behavior: AttendanceBehaviorValue.AUSENTE_INJUSTIFICADO, absenceValue: 1 },
    });

    expect(() => computeStudentTotals({}, cat)).not.toThrow();
    const totals = computeStudentTotals({}, cat);

    expect(totals).toEqual({
      tardesJust: 0,
      tardesInj: 0,
      totalTardes: 0,
      ausJust: 0,
      ausInj: 0,
      ausTotal: 0,
    });
  });

  it('days with behavior 3, 4, 7 contribute to none of the six totals', () => {
    const cat = catalog({
      DOM: { behavior: AttendanceBehaviorValue.NO_ELEGIBLE, absenceValue: 0 },
      P: { behavior: AttendanceBehaviorValue.NO_COMPUTA, absenceValue: 0 },
      FERIADO: { behavior: AttendanceBehaviorValue.DIA_NO_HABIL, absenceValue: 0 },
    });
    const days = { '1': 'DOM', '2': 'P', '3': 'FERIADO' };

    const totals = computeStudentTotals(days, cat);

    expect(totals).toEqual({
      tardesJust: 0,
      tardesInj: 0,
      totalTardes: 0,
      ausJust: 0,
      ausInj: 0,
      ausTotal: 0,
    });
  });

  it('unknown/missing catalog entry for a day code does not throw, contributes 0', () => {
    const cat = catalog({
      AI: { behavior: AttendanceBehaviorValue.AUSENTE_INJUSTIFICADO, absenceValue: 1 },
    });
    const days = { '1': 'AI', '2': 'DOES_NOT_EXIST' };

    expect(() => computeStudentTotals(days, cat)).not.toThrow();
    const totals = computeStudentTotals(days, cat);

    expect(totals.ausInj).toBe(1);
    expect(totals.ausTotal).toBe(1);
  });
});

describe('computeDiasHabiles', () => {
  it('P2-5: 30-day month, 4 Sundays (behavior 3) + 1 weekday Feriado (behavior 7) → diasHabiles = 30 - 5 = 25', () => {
    const cat = catalog({
      DOM: { behavior: AttendanceBehaviorValue.NO_ELEGIBLE, absenceValue: 0 },
      FERIADO: { behavior: AttendanceBehaviorValue.DIA_NO_HABIL, absenceValue: 0 },
    });
    const dayCodes = {
      '5': 'DOM',
      '12': 'DOM',
      '19': 'DOM',
      '26': 'DOM',
      '15': 'FERIADO',
    };

    expect(computeDiasHabiles(30, dayCodes, cat)).toBe(25);
  });

  it('P2-6: a day marked BOTH as calendar-Sunday-source and Feriado-source is subtracted exactly once, not twice', () => {
    const cat = catalog({
      DOM: { behavior: AttendanceBehaviorValue.NO_ELEGIBLE, absenceValue: 0 },
      FERIADO: { behavior: AttendanceBehaviorValue.DIA_NO_HABIL, absenceValue: 0 },
    });
    // Day 5 is a Sunday that was overridden with a Feriado code by an admin —
    // it can only carry ONE code, so a correct per-day Set-based classification
    // must count it once regardless of which "source" (calendar vs feriado) it maps to.
    const dayCodes = {
      '5': 'FERIADO',
      '12': 'DOM',
      '19': 'DOM',
      '26': 'DOM',
    };

    expect(computeDiasHabiles(30, dayCodes, cat)).toBe(26);
  });

  it('P2-7: 31-day month, 4 Sundays + 4 Saturdays + 2 weekday Feriados → diasHabiles = 31 - 10 = 21', () => {
    const cat = catalog({
      DOM: { behavior: AttendanceBehaviorValue.NO_ELEGIBLE, absenceValue: 0 },
      SAB: { behavior: AttendanceBehaviorValue.NO_ELEGIBLE, absenceValue: 0 },
      FERIADO: { behavior: AttendanceBehaviorValue.DIA_NO_HABIL, absenceValue: 0 },
    });
    const dayCodes = {
      '4': 'SAB',
      '11': 'SAB',
      '18': 'SAB',
      '25': 'SAB',
      '5': 'DOM',
      '12': 'DOM',
      '19': 'DOM',
      '26': 'DOM',
      '15': 'FERIADO',
      '22': 'FERIADO',
    };

    expect(computeDiasHabiles(31, dayCodes, cat)).toBe(21);
  });

  it('P2-10: month with 28 days evaluated over a 31-column grid → columns 29/30/31 excluded from días hábiles subtraction', () => {
    const cat = catalog({
      DOM: { behavior: AttendanceBehaviorValue.NO_ELEGIBLE, absenceValue: 0 },
      X: { behavior: AttendanceBehaviorValue.NO_ELEGIBLE, absenceValue: 0 },
    });
    // Grid has 31 columns rendered by the web layer, but this month only has 28 days.
    // Columns 29/30/31 are marked "X" (non-existent) — the pure function must only
    // evaluate 1..daysInMonth (28) and ignore the extra grid columns entirely.
    const dayCodes = {
      '2': 'DOM',
      '9': 'DOM',
      '16': 'DOM',
      '23': 'DOM',
      '29': 'X',
      '30': 'X',
      '31': 'X',
    };

    expect(computeDiasHabiles(28, dayCodes, cat)).toBe(24);
  });

  it('AC-P2-12: days with behavior in {1,2,4,5,6} count as día hábil (not subtracted)', () => {
    const cat = catalog({
      AI: { behavior: AttendanceBehaviorValue.AUSENTE_INJUSTIFICADO, absenceValue: 1 },
      AJ: { behavior: AttendanceBehaviorValue.AUSENTE_JUSTIFICADO, absenceValue: 1 },
      P: { behavior: AttendanceBehaviorValue.NO_COMPUTA, absenceValue: 0 },
      TI: { behavior: AttendanceBehaviorValue.TARDE_INJUSTIFICADA, absenceValue: 1 },
      TJ: { behavior: AttendanceBehaviorValue.TARDE_JUSTIFICADA, absenceValue: 0.5 },
    });
    const dayCodes = {
      '1': 'AI',
      '2': 'AJ',
      '3': 'P',
      '4': 'TI',
      '5': 'TJ',
    };

    expect(computeDiasHabiles(5, dayCodes, cat)).toBe(5);
  });

  it('unknown/missing catalog entry for a day code does not throw and does not subtract from días hábiles', () => {
    const cat = catalog({
      DOM: { behavior: AttendanceBehaviorValue.NO_ELEGIBLE, absenceValue: 0 },
    });
    const dayCodes = { '5': 'DOM', '6': 'DOES_NOT_EXIST' };

    expect(() => computeDiasHabiles(30, dayCodes, cat)).not.toThrow();
    expect(computeDiasHabiles(30, dayCodes, cat)).toBe(29);
  });

  it('student with no marks at all → días hábiles = daysInMonth (nothing subtracted)', () => {
    const cat = catalog({});
    expect(computeDiasHabiles(30, {}, cat)).toBe(30);
  });
});
