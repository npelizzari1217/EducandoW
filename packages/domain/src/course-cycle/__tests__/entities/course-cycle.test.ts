import { describe, it, expect } from 'vitest';
import { CourseCycle } from '../../entities/course-cycle';
import { CourseName } from '../../value-objects/course-name';
import { PassingGrade } from '../../value-objects/passing-grade';
import { BimonthPeriod } from '../../value-objects/bimonth-period';
import { GradingPhase } from '../../value-objects/grading-phase';
import { Level, LevelType } from '../../../institution/value-objects/level';
import { CourseCycleClosedError } from '../../errors';
import type { DateRange } from '../../services/grading-period-calculator';

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
      expect(cc.firstBimonth!.equals(firstBim)).toBe(true);
      expect(cc.secondBimonth!.equals(secondBim)).toBe(true);
      expect(cc.thirdBimonth!.equals(thirdBim)).toBe(true);
      expect(cc.fourthBimonth!.equals(fourthBim)).toBe(true);
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
        activeGradingPeriod: null,
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

  describe('getCurrentPeriod()', () => {
    function makeRanges(offsetDays: number): DateRange[] {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - offsetDays);
      const end = new Date(now);
      end.setDate(end.getDate() + offsetDays);
      return [{ start, end }];
    }

    it('returns explicit override when activeGradingPeriod is set', () => {
      const cc = CourseCycle.reconstruct({
        id: { get: () => 'id' } as any,
        uuid: 'uuid-1',
        courseId,
        studyPlanId,
        cycleId,
        courseName,
        level,
        active: true,
        passingGrade,
        promotionText: null,
        firstBimonth: null,
        secondBimonth: null,
        thirdBimonth: null,
        fourthBimonth: null,
        activeGradingPeriod: 3, // explicit override
        createdAt: new Date(),
        lastModifiedAt: new Date(),
      });

      // Even if ranges contain today, should return the explicit value 3
      const result = cc.getCurrentPeriod(makeRanges(5));
      expect(result).toBe(3);
    });

    it('returns calculated period when no explicit override', () => {
      const cc = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });
      // activeGradingPeriod starts null in create()

      const activeRanges = makeRanges(5);
      const result = cc.getCurrentPeriod(activeRanges);
      expect(result).toBe(1); // first (and only) range in the array
    });

    it('returns null when no override and today is outside all ranges', () => {
      const cc = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });

      const pastRanges: DateRange[] = [
        { start: new Date('2020-01-01'), end: new Date('2020-03-31') },
      ];
      const result = cc.getCurrentPeriod(pastRanges);
      expect(result).toBeNull();
    });

    it('returns null when no override and ranges are empty', () => {
      const cc = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });

      const result = cc.getCurrentPeriod([]);
      expect(result).toBeNull();
    });

    it('setActiveGradingPeriod changes the override and updates lastModifiedAt', () => {
      const cc = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
      });
      const before = cc.lastModifiedAt;

      cc.setActiveGradingPeriod(2);

      expect(cc.activeGradingPeriod).toBe(2);
      expect(cc.lastModifiedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('setActiveGradingPeriod(null) clears the override', () => {
      const cc = CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName, level, passingGrade,
      });
      cc.setActiveGradingPeriod(2);
      cc.setActiveGradingPeriod(null);

      expect(cc.activeGradingPeriod).toBeNull();
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
      expect(cc.firstBimonth!.equals(firstBim)).toBe(true);
    });
  });

  describe('gradingPhase', () => {
    function makeCC(lvl: LevelType) {
      return CourseCycle.create({
        courseId, studyPlanId, cycleId, courseName,
        level: Level.reconstruct(lvl),
        passingGrade,
        firstBimonth: firstBim, secondBimonth: secondBim,
        thirdBimonth: thirdBim, fourthBimonth: fourthBim,
      });
    }

    describe('create() defaults', () => {
      it('starts with gradingPhase = null', () => {
        const cc = makeCC(LevelType.PRIMARIO);
        expect(cc.gradingPhase).toBeNull();
      });
    });

    describe('requiresGradingPhase()', () => {
      it.each([LevelType.PRIMARIO, LevelType.TALLERES_PRIMARIO, LevelType.BILINGÜISMO_PRIMARIO])(
        'is true for Primario level %s',
        (lvl) => {
          expect(makeCC(lvl).requiresGradingPhase()).toBe(true);
        },
      );

      it.each([LevelType.SECUNDARIO, LevelType.TALLERES_SECUNDARIO, LevelType.BILINGÜISMO_SECUNDARIO])(
        'is true for Secundario level %s',
        (lvl) => {
          expect(makeCC(lvl).requiresGradingPhase()).toBe(true);
        },
      );

      it('is false for Inicial', () => {
        expect(makeCC(LevelType.INICIAL).requiresGradingPhase()).toBe(false);
      });

      it('is false for Terciario', () => {
        expect(makeCC(LevelType.TERCIARIO).requiresGradingPhase()).toBe(false);
      });
    });

    describe('setGradingPhase()', () => {
      it('sets the phase and touches lastModifiedAt', () => {
        const cc = makeCC(LevelType.PRIMARIO);
        const before = cc.lastModifiedAt;
        const phase = GradingPhase.create('BIM_2').unwrap();

        cc.setGradingPhase(phase);

        expect(cc.gradingPhase!.equals(phase)).toBe(true);
        expect(cc.lastModifiedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      });

      it('is reversible: CIERRE back to a bimester', () => {
        const cc = makeCC(LevelType.SECUNDARIO);
        cc.setGradingPhase(GradingPhase.create('CIERRE').unwrap());

        cc.setGradingPhase(GradingPhase.create('BIM_3').unwrap());

        expect(cc.gradingPhase!.code).toBe('BIM_3');
      });

      it('clears the phase back to null', () => {
        const cc = makeCC(LevelType.PRIMARIO);
        cc.setGradingPhase(GradingPhase.create('BIM_1').unwrap());

        cc.setGradingPhase(null);

        expect(cc.gradingPhase).toBeNull();
      });
    });

    describe('canGradeBimester()', () => {
      it('rejects all bimesters when phase is null (hard cutover)', () => {
        const cc = makeCC(LevelType.PRIMARIO);
        expect(cc.canGradeBimester(1)).toBe(false);
        expect(cc.canGradeBimester(2)).toBe(false);
        expect(cc.canGradeBimester(3)).toBe(false);
        expect(cc.canGradeBimester(4)).toBe(false);
      });

      it('allows only the matching ordinal for BIM_n', () => {
        const cc = makeCC(LevelType.PRIMARIO);
        cc.setGradingPhase(GradingPhase.create('BIM_2').unwrap());

        expect(cc.canGradeBimester(1)).toBe(false);
        expect(cc.canGradeBimester(2)).toBe(true);
        expect(cc.canGradeBimester(3)).toBe(false);
        expect(cc.canGradeBimester(4)).toBe(false);
      });

      it('rejects all bimesters during CIERRE', () => {
        const cc = makeCC(LevelType.SECUNDARIO);
        cc.setGradingPhase(GradingPhase.create('CIERRE').unwrap());

        expect(cc.canGradeBimester(1)).toBe(false);
        expect(cc.canGradeBimester(2)).toBe(false);
        expect(cc.canGradeBimester(3)).toBe(false);
        expect(cc.canGradeBimester(4)).toBe(false);
      });
    });

    describe('canGradeFinal()', () => {
      it('is false when phase is null', () => {
        expect(makeCC(LevelType.SECUNDARIO).canGradeFinal()).toBe(false);
      });

      it('is false during any bimester', () => {
        const cc = makeCC(LevelType.SECUNDARIO);
        cc.setGradingPhase(GradingPhase.create('BIM_4').unwrap());
        expect(cc.canGradeFinal()).toBe(false);
      });

      it('is true only during CIERRE', () => {
        const cc = makeCC(LevelType.SECUNDARIO);
        cc.setGradingPhase(GradingPhase.create('CIERRE').unwrap());
        expect(cc.canGradeFinal()).toBe(true);
      });
    });
  });
});
