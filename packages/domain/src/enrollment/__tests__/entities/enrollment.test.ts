import { describe, it, expect } from 'vitest';
import { Enrollment } from '../../entities/enrollment';
import { EnrollmentStatus } from '../../value-objects/enrollment-status';
import { Id } from '../../../shared/value-objects/id';
import { Level, LevelType } from '../../../institution/value-objects/level';
import { ValidationError } from '../../../shared/errors/validation-error';

describe('Enrollment', () => {
  const validProps = {
    studentId: Id.create(),
    institutionId: Id.create(),
    level: Level.reconstruct(LevelType.PRIMARIO),
    academicYear: '2025',
    grade: '3°',
  };

  it('creates enrollment with ACTIVE status', () => {
    const e = Enrollment.create(validProps).unwrap();
    expect(e.status).toBeInstanceOf(EnrollmentStatus);
    expect(e.status.value).toBe('ACTIVE');
    expect(e.level.toString()).toBe('PRIMARIO');
    expect(e.academicYear).toBe('2025');
  });

  it('enrolledAt is set to current date', () => {
    const e = Enrollment.create(validProps).unwrap();
    expect(e.enrolledAt).toBeInstanceOf(Date);
  });

  it('changeStatus updates the status via VO', () => {
    const e = Enrollment.create(validProps).unwrap();
    const graduated = EnrollmentStatus.reconstruct('GRADUATED');
    e.changeStatus(graduated);
    expect(e.status.value).toBe('GRADUATED');
  });

  it('reconstruct preserves division and grade', () => {
    const now = new Date();
    const e = Enrollment.reconstruct({
      ...validProps,
      id: Id.create(),
      division: 'A',
      status: EnrollmentStatus.reconstruct('ACTIVE'),
      enrolledAt: now,
    });
    expect(e.division).toBe('A');
    expect(e.grade).toBe('3°');
    expect(e.status.value).toBe('ACTIVE');
  });

  describe('activeGradingPeriod', () => {
    it('new enrollment defaults activeGradingPeriod to null', () => {
      const e = Enrollment.create(validProps).unwrap();
      expect(e.activeGradingPeriod).toBeNull();
    });

    it('create with explicit activeGradingPeriod propagates the value', () => {
      const e = Enrollment.create({ ...validProps, activeGradingPeriod: 2 }).unwrap();
      expect(e.activeGradingPeriod).toBe(2);
    });

    it('reconstruct preserves activeGradingPeriod', () => {
      const now = new Date();
      const e = Enrollment.reconstruct({
        ...validProps,
        id: Id.create(),
        status: EnrollmentStatus.reconstruct('ACTIVE'),
        enrolledAt: now,
        activeGradingPeriod: 3,
      });
      expect(e.activeGradingPeriod).toBe(3);
    });

    it('reconstruct defaults activeGradingPeriod to null when not provided', () => {
      const now = new Date();
      const e = Enrollment.reconstruct({
        ...validProps,
        id: Id.create(),
        status: EnrollmentStatus.reconstruct('ACTIVE'),
        enrolledAt: now,
      });
      expect(e.activeGradingPeriod).toBeNull();
    });

    it('setActiveGradingPeriod updates the value', () => {
      const e = Enrollment.create(validProps).unwrap();
      e.setActiveGradingPeriod(1);
      expect(e.activeGradingPeriod).toBe(1);
    });

    it('setActiveGradingPeriod(null) clears the value', () => {
      const e = Enrollment.create({ ...validProps, activeGradingPeriod: 2 }).unwrap();
      e.setActiveGradingPeriod(null);
      expect(e.activeGradingPeriod).toBeNull();
    });
  });

  describe('printable and promoted flags', () => {
    it('new enrollment defaults printable=true, promoted=false', () => {
      const e = Enrollment.create(validProps).unwrap();
      expect(e.printable).toBe(true);
      expect(e.promoted).toBe(false);
    });

    it('setPrintable changes the flag', () => {
      const e = Enrollment.create(validProps).unwrap();
      expect(e.printable).toBe(true);
      e.setPrintable(false);
      expect(e.printable).toBe(false);
      e.setPrintable(true);
      expect(e.printable).toBe(true);
    });

    it('setPromoted changes the flag', () => {
      const e = Enrollment.create(validProps).unwrap();
      expect(e.promoted).toBe(false);
      e.setPromoted(true);
      expect(e.promoted).toBe(true);
    });

    it('reconstruct preserves printable and promoted', () => {
      const now = new Date();
      const e = Enrollment.reconstruct({
        ...validProps,
        id: Id.create(),
        status: EnrollmentStatus.reconstruct('ACTIVE'),
        enrolledAt: now,
        printable: false,
        promoted: true,
      });
      expect(e.printable).toBe(false);
      expect(e.promoted).toBe(true);
    });

    it('reconstruct defaults printable=true, promoted=false when not provided', () => {
      const now = new Date();
      const e = Enrollment.reconstruct({
        ...validProps,
        id: Id.create(),
        status: EnrollmentStatus.reconstruct('ACTIVE'),
        enrolledAt: now,
      });
      expect(e.printable).toBe(true);
      expect(e.promoted).toBe(false);
    });

    it('togglePrintable flips printable from true to false', () => {
      const e = Enrollment.create(validProps).unwrap();
      expect(e.printable).toBe(true);
      e.togglePrintable();
      expect(e.printable).toBe(false);
    });

    it('togglePrintable flips printable back to true on second call', () => {
      const e = Enrollment.create(validProps).unwrap();
      e.togglePrintable();
      e.togglePrintable();
      expect(e.printable).toBe(true);
    });

    it('togglePromoted flips promoted from false to true', () => {
      const e = Enrollment.create(validProps).unwrap();
      expect(e.promoted).toBe(false);
      e.togglePromoted();
      expect(e.promoted).toBe(true);
    });

    it('create returns Result.fail with ValidationError when printable is a non-boolean string', () => {
      const result = Enrollment.create({ ...validProps, printable: 'yes' as unknown as boolean });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
      expect(result.unwrapErr().message).toContain('printable');
    });

    it('create returns Result.fail with ValidationError when printable is null', () => {
      const result = Enrollment.create({ ...validProps, printable: null as unknown as boolean });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
    });

    it('create returns Result.fail with ValidationError when promoted is a non-boolean', () => {
      const result = Enrollment.create({ ...validProps, promoted: 1 as unknown as boolean });
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
      expect(result.unwrapErr().message).toContain('promoted');
    });
  });
});
