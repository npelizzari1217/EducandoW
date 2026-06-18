import { describe, it, expect } from 'vitest';
import { RangoFechas } from '../../value-objects/rango-fechas';
import { InvalidLlamadoRangeError } from '../../errors/invalid-llamado-range.error';

describe('RangoFechas', () => {
  describe('create()', () => {
    it('returns ok when inicio < fin', () => {
      const inicio = new Date('2025-07-01');
      const fin = new Date('2025-07-15');
      const result = RangoFechas.create(inicio, fin);
      expect(result.isOk()).toBe(true);
      const rango = result.unwrap();
      expect(rango.inicio).toEqual(inicio);
      expect(rango.fin).toEqual(fin);
    });

    it('returns ok when inicio === fin (equal dates are VALID)', () => {
      const date = new Date('2025-07-01');
      const result = RangoFechas.create(date, date);
      expect(result.isOk()).toBe(true);
    });

    it('returns err(InvalidLlamadoRangeError) when inicio > fin', () => {
      const inicio = new Date('2025-07-15');
      const fin = new Date('2025-07-01');
      const result = RangoFechas.create(inicio, fin);
      expect(result.isErr()).toBe(true);
      const error = result.unwrapErr();
      expect(error).toBeInstanceOf(InvalidLlamadoRangeError);
      expect(error.code).toBe('INVALID_LLAMADO_RANGE');
    });
  });

  describe('overlaps()', () => {
    const make = (start: string, end: string) =>
      RangoFechas.create(new Date(start), new Date(end)).unwrap();

    it('[07-01, 07-15] vs [07-10, 07-20] → true (partial overlap)', () => {
      const a = make('2025-07-01', '2025-07-15');
      const b = { inicio: new Date('2025-07-10'), fin: new Date('2025-07-20') };
      expect(a.overlaps(b)).toBe(true);
    });

    it('[07-01, 07-15] vs [07-16, 07-31] → false (boundary-adjacent: must NOT overlap)', () => {
      const a = make('2025-07-01', '2025-07-15');
      const b = { inicio: new Date('2025-07-16'), fin: new Date('2025-07-31') };
      expect(a.overlaps(b)).toBe(false);
    });

    it('[07-01, 07-15] vs [07-01, 07-15] → true (same range)', () => {
      const a = make('2025-07-01', '2025-07-15');
      const b = { inicio: new Date('2025-07-01'), fin: new Date('2025-07-15') };
      expect(a.overlaps(b)).toBe(true);
    });

    it('[07-01, 07-15] vs [07-15, 07-16] → true (end-start touch = overlap)', () => {
      const a = make('2025-07-01', '2025-07-15');
      const b = { inicio: new Date('2025-07-15'), fin: new Date('2025-07-16') };
      expect(a.overlaps(b)).toBe(true);
    });

    it('[07-01, 07-31] vs [06-01, 08-31] → true (contained)', () => {
      const a = make('2025-07-01', '2025-07-31');
      const b = { inicio: new Date('2025-06-01'), fin: new Date('2025-08-31') };
      expect(a.overlaps(b)).toBe(true);
    });
  });
});
