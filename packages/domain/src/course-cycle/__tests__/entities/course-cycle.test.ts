import { describe, it, expect } from 'vitest';
import { CourseCycle } from '../../entities/course-cycle';
import { CourseName } from '../../value-objects/course-name';
import { PassingGrade } from '../../value-objects/passing-grade';
import { BimonthPeriod } from '../../value-objects/bimonth-period';
import { Level, LevelType } from '../../../institution/value-objects/level';
import { CourseCycleClosedError } from '../../errors';

function makeBimonth(start: string, end: string): BimonthPeriod {
  return BimonthPeriod.create(new Date(start), new Date(end)).unwrap();
}

describe('CourseCycle', () => {
  const courseId = '550e8400-e29b-41d4-a716-446655440001';
  const studyPlanId = '550e8400-e29b-41d4-a716-446655440002';
  const cycleId = '550e8400-e29b-41d4-a716-446655440003';
  const level = Level.reconstruct(LevelType.PRIMARIO);
  const courseName = CourseName.create('MATEMÁTICA').unwrap();
  const passingGrade = PassingGrade.create(6).unwrap();
  const firstBim = makeBimonth('2026-03-01', '2026-04-30');
  const secondBim = makeBimonth('2026-05-01', '2026-06-30');
  const thirdBim = makeBimonth('2026-07-01', '2026-08-31');
  const fourthBim = makeBimonth('2026-09-01', '2026-10-31');
  const promotionText = 'Aprueba con 6';

  describe('create()', () => {
    it('creates a valid CourseCycle with all fields', () => {
      const cc = CourseCycle.create({
        courseId,
        studyPlanId,
        cycleId,
        courseName,
        level,
        passingGrade,
        promotionText,
        firstBimonth: firstBim,
        secondBimonth: secondBim,
        thirdBimonth: thirdBim,
        fourthBimonth: fourthBim,
      });

      expect(cc.courseId).toBe(courseId);
      expect(cc.studyPlanId).toBe(studyPlanId);
      expect(cc.cycleId).toBe(cycleId);
      expect(cc.courseName.equals(courseName)).toBe(true);
      expect(cc.level.equals(level)).toBe(true);
      expect(cc.active).toBe(true);
      expect(cc.passingGrade.equals(passingGrade)).toBe(true);
      expect(cc.promotionText).toBe(promotionText);
      expect(cc.firstBimonth.equals(firstBim)).toBe(true);
      expect(cc.secondBimonth.equals(secondBim)).toBe(true);
      expect(cc.thirdBimonth.equals(thirdBim)).toBe(true);
      expect(cc.fourthBimonth.equals(fourthBim)).toBe(true);
      expect(cc.deletedAt).toBeUndefined();
      expect(cc.createdAt).toBeInstanceOf(Date);
      expect(cc.lastModifiedAt).toBeInstanceOf(Date);
    });

    it('creates with optional promotionText as null', () => {
      const cc = CourseCycle.create({
        courseId,
        studyPlanId,
        cycleId,
        courseName,
        level,
        passingGrade,
        firstBimonth: firstBim,
        secondBimonth: secondBim,
        thirdBimonth: thirdBim,
        fourthBimonth: fourthBim,
      });

      expect(cc.promotionText).toBeNull();
    });

    it('generates a unique id', () => {
      const a = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });
      const b = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });

      expect(a.id.get()).not.toBe(b.id.get());
    });
  });

  describe('ensureActive()', () => {
    it('does not throw when active is true', () => {
      const cc = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });

      expect(() => cc.ensureActive()).not.toThrow();
    });

    it('throws CourseCycleClosedError when active is false', () => {
      const cc = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });
      cc.deactivate();

      expect(() => cc.ensureActive()).toThrow(CourseCycleClosedError);
    });
  });

  describe('softDelete()', () => {
    it('sets active to false and records deletedAt', () => {
      const cc = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });

      cc.softDelete();

      expect(cc.active).toBe(false);
      expect(cc.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('activate() / deactivate()', () => {
    it('deactivate sets active to false and updates lastModifiedAt', () => {
      const cc = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });
      const before = cc.lastModifiedAt;

      cc.deactivate();

      expect(cc.active).toBe(false);
      expect(cc.lastModifiedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('activate sets active back to true', () => {
      const cc = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });
      cc.deactivate();
      cc.activate();

      expect(cc.active).toBe(true);
    });
  });

  describe('reconstruct()', () => {
    it('reconstructs an entity with given props', () => {
      const id = { get: () => 'test-id' } as any;
      const createdAt = new Date('2026-01-01');
      const lastModifiedAt = new Date('2026-06-01');
      const deletedAt = new Date('2026-07-01');

      const cc = CourseCycle.reconstruct({
        id,
        uuid: 'uuid-123',
        courseId,
        studyPlanId,
        cycleId,
        courseName,
        level,
        active: false,
        passingGrade,
        promotionText,
        firstBimonth: firstBim,
        secondBimonth: secondBim,
        thirdBimonth: thirdBim,
        fourthBimonth: fourthBim,
        createdAt,
        lastModifiedAt,
        deletedAt,
      });

      expect(cc.courseId).toBe(courseId);
      expect(cc.uuid).toBe('uuid-123');
      expect(cc.active).toBe(false);
      expect(cc.deletedAt).toBe(deletedAt);
      expect(cc.createdAt).toBe(createdAt);
    });
  });

  describe('update()', () => {
    it('updates mutable fields and refreshes lastModifiedAt', () => {
      const cc = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });
      const before = cc.lastModifiedAt;
      const newName = CourseName.create('LENGUA').unwrap();
      const newGrade = PassingGrade.create(7).unwrap();

      cc.update({
        courseName: newName,
        passingGrade: newGrade,
        promotionText: 'Nuevo texto',
      });

      expect(cc.courseName.equals(newName)).toBe(true);
      expect(cc.passingGrade.equals(newGrade)).toBe(true);
      expect(cc.promotionText).toBe('Nuevo texto');
      expect(cc.lastModifiedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('preserves unchanged fields', () => {
      const cc = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });

      cc.update({});

      expect(cc.courseName.equals(courseName)).toBe(true);
      expect(cc.passingGrade.equals(passingGrade)).toBe(true);
      expect(cc.firstBimonth.equals(firstBim)).toBe(true);
    });
  });
});
