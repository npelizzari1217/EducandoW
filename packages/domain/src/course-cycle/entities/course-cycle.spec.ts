/**
 * PR3-T4 [RED] — CourseCycle entity: homeroomTeacherId field and assignHomeroomTeacher method.
 * Specs: TIA-R5, AD-6
 */
import { describe, it, expect } from 'vitest';
import { CourseCycle } from './course-cycle';
import { CourseName } from '../value-objects/course-name';
import { PassingGrade } from '../value-objects/passing-grade';
import { Level, LevelType } from '../../institution/value-objects/level';
import { Id } from '../../shared/value-objects/id';

const baseInput = {
  courseId: 'course-uuid-1',
  studyPlanId: 'plan-uuid-1',
  cycleId: 'cycle-uuid-1',
  courseName: CourseName.create('MATEMÁTICA').unwrap(),
  level: Level.reconstruct(LevelType.PRIMARIO),
  passingGrade: PassingGrade.create(6).unwrap(),
};

describe('CourseCycle — homeroomTeacherId', () => {
  it('homeroomTeacherId is undefined by default on create()', () => {
    const cc = CourseCycle.create(baseInput);
    expect(cc.homeroomTeacherId).toBeUndefined();
  });

  it('homeroomTeacherId is undefined by default on reconstruct() without it', () => {
    const now = new Date();
    const cc = CourseCycle.reconstruct({
      ...baseInput,
      id: Id.create(),
      uuid: Id.create().get(),
      active: true,
      promotionText: null,
      firstBimonth: null,
      secondBimonth: null,
      thirdBimonth: null,
      fourthBimonth: null,
      activeGradingPeriod: null,
      createdAt: now,
      lastModifiedAt: now,
    });
    expect(cc.homeroomTeacherId).toBeUndefined();
  });

  it('reconstruct() with homeroomTeacherId set returns the value', () => {
    const now = new Date();
    const cc = CourseCycle.reconstruct({
      ...baseInput,
      id: Id.create(),
      uuid: Id.create().get(),
      active: true,
      promotionText: null,
      firstBimonth: null,
      secondBimonth: null,
      thirdBimonth: null,
      fourthBimonth: null,
      activeGradingPeriod: null,
      createdAt: now,
      lastModifiedAt: now,
      homeroomTeacherId: 'teacher-uuid-1',
    });
    expect(cc.homeroomTeacherId).toBe('teacher-uuid-1');
  });

  it('assignHomeroomTeacher() sets homeroomTeacherId and getter returns the value', () => {
    const cc = CourseCycle.create(baseInput);
    cc.assignHomeroomTeacher('teacher-uuid-2');
    expect(cc.homeroomTeacherId).toBe('teacher-uuid-2');
  });

  it('assignHomeroomTeacher() can overwrite a previously set homeroomTeacherId', () => {
    const now = new Date();
    const cc = CourseCycle.reconstruct({
      ...baseInput,
      id: Id.create(),
      uuid: Id.create().get(),
      active: true,
      promotionText: null,
      firstBimonth: null,
      secondBimonth: null,
      thirdBimonth: null,
      fourthBimonth: null,
      activeGradingPeriod: null,
      createdAt: now,
      lastModifiedAt: now,
      homeroomTeacherId: 'teacher-old',
    });
    cc.assignHomeroomTeacher('teacher-new');
    expect(cc.homeroomTeacherId).toBe('teacher-new');
  });
});
