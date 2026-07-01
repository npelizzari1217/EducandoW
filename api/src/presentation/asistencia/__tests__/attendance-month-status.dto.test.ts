/**
 * AttendanceMonthStatus DTOs — unit tests (TDD RED, PR-3b).
 *
 * Covers:
 *   DTO-T01: AttendanceMonthStatusQuerySchema — accepts valid year/month, coerces from query strings
 *   DTO-T02: AttendanceMonthStatusQuerySchema — rejects month out of 1..12 range
 *   DTO-T03: AttendanceMonthStatusQuerySchema — rejects year out of reasonable range
 *   DTO-T04: SetAttendanceMonthStatusSchema — accepts {year, month, status: 'OPEN'|'CLOSED'}
 *   DTO-T05: SetAttendanceMonthStatusSchema — rejects invalid status value
 *   DTO-T06: SetAttendanceMonthStatusSchema — rejects missing fields / out-of-range month/year
 */
import { describe, it, expect } from 'vitest';
import { AttendanceMonthStatusQuerySchema, SetAttendanceMonthStatusSchema } from '../dto/asistencia.dto';

describe('AttendanceMonthStatusQuerySchema', () => {
  describe('DTO-T01: accepts valid year/month, coerces from query strings', () => {
    it('accepts numeric year/month', () => {
      const result = AttendanceMonthStatusQuerySchema.safeParse({ year: 2026, month: 6 });
      expect(result.success).toBe(true);
    });

    it('coerces string query params to numbers', () => {
      const result = AttendanceMonthStatusQuerySchema.safeParse({ year: '2026', month: '6' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(2026);
        expect(result.data.month).toBe(6);
      }
    });
  });

  describe('DTO-T02: rejects month out of 1..12 range', () => {
    it.each([0, 13, -1])('rejects month=%i', (month) => {
      const result = AttendanceMonthStatusQuerySchema.safeParse({ year: 2026, month });
      expect(result.success).toBe(false);
    });
  });

  describe('DTO-T03: rejects year out of reasonable range', () => {
    it.each([1999, 2200])('rejects year=%i', (year) => {
      const result = AttendanceMonthStatusQuerySchema.safeParse({ year, month: 6 });
      expect(result.success).toBe(false);
    });
  });
});

describe('SetAttendanceMonthStatusSchema', () => {
  describe('DTO-T04: accepts {year, month, status}', () => {
    it.each(['OPEN', 'CLOSED'])('accepts status=%s', (status) => {
      const result = SetAttendanceMonthStatusSchema.safeParse({ year: 2026, month: 6, status });
      expect(result.success).toBe(true);
    });
  });

  describe('DTO-T05: rejects invalid status value', () => {
    it('rejects an unknown status string', () => {
      const result = SetAttendanceMonthStatusSchema.safeParse({ year: 2026, month: 6, status: 'HALF_OPEN' });
      expect(result.success).toBe(false);
    });
  });

  describe('DTO-T06: rejects missing fields / out-of-range month/year', () => {
    it('rejects missing status', () => {
      const result = SetAttendanceMonthStatusSchema.safeParse({ year: 2026, month: 6 });
      expect(result.success).toBe(false);
    });

    it('rejects month=13', () => {
      const result = SetAttendanceMonthStatusSchema.safeParse({ year: 2026, month: 13, status: 'OPEN' });
      expect(result.success).toBe(false);
    });

    it('rejects year=1999', () => {
      const result = SetAttendanceMonthStatusSchema.safeParse({ year: 1999, month: 6, status: 'OPEN' });
      expect(result.success).toBe(false);
    });
  });
});
