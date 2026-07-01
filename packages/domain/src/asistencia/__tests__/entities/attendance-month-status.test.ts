/**
 * AttendanceMonthStatus — domain entity unit tests. Strict TDD (RED first).
 * Capacidad B (cierre mensual de asistencia) — ORTOGONAL a la Capacidad A
 * (fase de calificación). No depende de GradingPhase/CourseCycle.gradingPhase.
 * Satisfies: AC-B-4, AC-B-5, AC-B-6, AC-B-8, AC-B-9, AC-B-10, AC-B-11.
 */
import { describe, it, expect } from 'vitest';
import { AttendanceMonthStatus } from '../../entities/attendance-month-status';

describe('AttendanceMonthStatus', () => {
  const courseCycleId = 'cc-uuid-1';

  describe('create()', () => {
    it('defaults to open (closed=false) with no closedAt/closedBy', () => {
      const status = AttendanceMonthStatus.create({ courseCycleId, year: 2026, month: 3 });

      expect(status.courseCycleId).toBe(courseCycleId);
      expect(status.year).toBe(2026);
      expect(status.month).toBe(3);
      expect(status.closed).toBe(false);
      expect(status.isClosed()).toBe(false);
      expect(status.closedAt).toBeNull();
      expect(status.closedBy).toBeNull();
    });

    it('assigns a fresh id', () => {
      const a = AttendanceMonthStatus.create({ courseCycleId, year: 2026, month: 3 });
      const b = AttendanceMonthStatus.create({ courseCycleId, year: 2026, month: 4 });
      expect(a.id.get()).not.toBe(b.id.get());
    });
  });

  describe('reconstruct()', () => {
    it('rehydrates all props as-is (no re-derivation)', () => {
      const closedAt = new Date('2026-04-05T12:00:00Z');
      const status = AttendanceMonthStatus.reconstruct({
        id: AttendanceMonthStatus.create({ courseCycleId, year: 2026, month: 3 }).id,
        courseCycleId,
        year: 2026,
        month: 3,
        closed: true,
        closedAt,
        closedBy: 'user-1',
      });

      expect(status.closed).toBe(true);
      expect(status.closedAt).toBe(closedAt);
      expect(status.closedBy).toBe('user-1');
    });
  });

  describe('monthOrdinal', () => {
    it('is year*12 + (month-1) — a monotonic chronological ordinal', () => {
      const jan2026 = AttendanceMonthStatus.create({ courseCycleId, year: 2026, month: 1 });
      const dec2025 = AttendanceMonthStatus.create({ courseCycleId, year: 2025, month: 12 });
      const mar2026 = AttendanceMonthStatus.create({ courseCycleId, year: 2026, month: 3 });

      expect(jan2026.monthOrdinal).toBe(2026 * 12 + 0);
      expect(dec2025.monthOrdinal).toBe(2025 * 12 + 11);
      // dec2025 immediately precedes jan2026 chronologically
      expect(jan2026.monthOrdinal - dec2025.monthOrdinal).toBe(1);
      expect(mar2026.monthOrdinal).toBeGreaterThan(jan2026.monthOrdinal);
    });
  });

  describe('canRecord() — AC-B-4/5/6: incondicional, sin excepción de rol', () => {
    it('true when open (default)', () => {
      const status = AttendanceMonthStatus.create({ courseCycleId, year: 2026, month: 3 });
      expect(status.canRecord()).toBe(true);
    });

    it('false when closed', () => {
      const status = AttendanceMonthStatus.create({ courseCycleId, year: 2026, month: 3 });
      status.close('user-1');
      expect(status.canRecord()).toBe(false);
    });
  });

  describe('close(userId)', () => {
    it('sets closed=true, closedAt=now, closedBy=userId', () => {
      const status = AttendanceMonthStatus.create({ courseCycleId, year: 2026, month: 3 });
      const before = new Date();

      status.close('secretario-1');

      expect(status.closed).toBe(true);
      expect(status.isClosed()).toBe(true);
      expect(status.closedBy).toBe('secretario-1');
      expect(status.closedAt).toBeInstanceOf(Date);
      expect(status.closedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('open(userId)', () => {
    it('clears closed/closedAt/closedBy — reversible reopening', () => {
      const status = AttendanceMonthStatus.create({ courseCycleId, year: 2026, month: 3 });
      status.close('secretario-1');

      status.open('secretario-2');

      expect(status.closed).toBe(false);
      expect(status.isClosed()).toBe(false);
      expect(status.closedAt).toBeNull();
      expect(status.closedBy).toBeNull();
    });
  });

  describe('canGenerate(previous) — AC-B-8/9/10: "último mes generado" no calendario', () => {
    it('permits generation when there is no previous generated month (first month exemption)', () => {
      expect(AttendanceMonthStatus.canGenerate(null)).toBe(true);
    });

    it('permits generation when the latest previous generated month is closed', () => {
      const previous = AttendanceMonthStatus.create({ courseCycleId, year: 2026, month: 2 });
      previous.close('secretario-1');
      expect(AttendanceMonthStatus.canGenerate(previous)).toBe(true);
    });

    it('rejects generation when the latest previous generated month is still open', () => {
      const previous = AttendanceMonthStatus.create({ courseCycleId, year: 2026, month: 2 });
      expect(AttendanceMonthStatus.canGenerate(previous)).toBe(false);
    });
  });
});
