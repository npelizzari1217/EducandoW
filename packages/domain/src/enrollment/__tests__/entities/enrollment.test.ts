import { describe, it, expect } from 'vitest';
import { Enrollment } from '../../entities/enrollment';
import { EnrollmentStatus } from '../../value-objects/enrollment-status';
import { Id } from '../../../shared/value-objects/id';
import { Level, LevelType } from '../../../institution/value-objects/level';

describe('Enrollment', () => {
  const validProps = {
    studentId: Id.create(),
    institutionId: Id.create(),
    level: Level.reconstruct(LevelType.PRIMARIO),
    academicYear: '2025',
    grade: '3°',
  };

  it('creates enrollment with ACTIVE status', () => {
    const e = Enrollment.create(validProps);
    expect(e.status).toBeInstanceOf(EnrollmentStatus);
    expect(e.status.value).toBe('ACTIVE');
    expect(e.level.toString()).toBe('PRIMARIO');
    expect(e.academicYear).toBe('2025');
  });

  it('enrolledAt is set to current date', () => {
    const e = Enrollment.create(validProps);
    expect(e.enrolledAt).toBeInstanceOf(Date);
  });

  it('changeStatus updates the status via VO', () => {
    const e = Enrollment.create(validProps);
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

  describe('printable and promoted flags', () => {
    it('new enrollment defaults printable=true, promoted=false', () => {
      const e = Enrollment.create(validProps);
      expect(e.printable).toBe(true);
      expect(e.promoted).toBe(false);
    });

    it('setPrintable changes the flag', () => {
      const e = Enrollment.create(validProps);
      expect(e.printable).toBe(true);
      e.setPrintable(false);
      expect(e.printable).toBe(false);
      e.setPrintable(true);
      expect(e.printable).toBe(true);
    });

    it('setPromoted changes the flag', () => {
      const e = Enrollment.create(validProps);
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
  });
});
