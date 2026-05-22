import { describe, it, expect } from 'vitest';
import { Enrollment } from '../../entities/enrollment';
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
    expect(e.status).toBe('ACTIVE');
    expect(e.level.toString()).toBe('PRIMARIO');
    expect(e.academicYear).toBe('2025');
  });

  it('enrolledAt is set to current date', () => {
    const e = Enrollment.create(validProps);
    expect(e.enrolledAt).toBeInstanceOf(Date);
  });

  it('changeStatus updates the status', () => {
    const e = Enrollment.create(validProps);
    e.changeStatus('GRADUATED');
    expect(e.status).toBe('GRADUATED');
  });

  it('reconstruct preserves division and grade', () => {
    const now = new Date();
    const e = Enrollment.reconstruct({ ...validProps, id: Id.create(), division: 'A', status: 'ACTIVE', enrolledAt: now });
    expect(e.division).toBe('A');
    expect(e.grade).toBe('3°');
  });
});
