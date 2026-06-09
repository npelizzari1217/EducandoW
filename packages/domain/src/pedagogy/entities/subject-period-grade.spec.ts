/**
 * PR1-T3 [RED] — SubjectPeriodGrade entity tests.
 * Specs: SPG-R1, SPG-R3, SPG-R4, PPF-R1, PPF-R4, AD-3
 */
import { describe, it, expect } from 'vitest';
import { SubjectPeriodGrade } from './subject-period-grade';
import { ValidationError } from '../../shared/errors/validation-error';

const BASE_INPUT = {
  studentId: 'student-uuid-1',
  courseCycleId: 'cc-uuid-1',
  subjectId: 'subj-uuid-1',
  periodOrdinal: 1,
};

// ─── create ──────────────────────────────────────────────────────────────────

describe('SubjectPeriodGrade.create', () => {
  it('creates an ungraded row with all grade fields null and flags all false', () => {
    const spg = SubjectPeriodGrade.create(BASE_INPUT);

    expect(spg.studentId).toBe('student-uuid-1');
    expect(spg.courseCycleId).toBe('cc-uuid-1');
    expect(spg.subjectId).toBe('subj-uuid-1');
    expect(spg.periodOrdinal).toBe(1);
    expect(spg.gradeScaleValueId).toBeNull();
    expect(spg.gradeCode).toBeNull();
    expect(spg.internalStatus).toBeNull();
    expect(spg.pa).toBe(false);
    expect(spg.ppi).toBe(false);
    expect(spg.pp).toBe(false);
  });

  it('assigns a UUID id on creation', () => {
    const spg = SubjectPeriodGrade.create(BASE_INPUT);
    expect(spg.id).toHaveLength(36);
  });
});

// ─── reconstruct ─────────────────────────────────────────────────────────────

describe('SubjectPeriodGrade.reconstruct', () => {
  it('preserves all props including flags', () => {
    const spg = SubjectPeriodGrade.reconstruct({
      id: 'spg-uuid-1',
      studentId: 'student-uuid-1',
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subj-uuid-1',
      periodOrdinal: 2,
      gradeScaleValueId: 'sv-uuid-1',
      gradeCode: 'MB',
      internalStatus: 'APROBADO',
      pa: true,
      ppi: false,
      pp: true,
    });

    expect(spg.id).toBe('spg-uuid-1');
    expect(spg.gradeScaleValueId).toBe('sv-uuid-1');
    expect(spg.gradeCode).toBe('MB');
    expect(spg.internalStatus).toBe('APROBADO');
    expect(spg.pa).toBe(true);
    expect(spg.ppi).toBe(false);
    expect(spg.pp).toBe(true);
  });
});

// ─── assignGrade ─────────────────────────────────────────────────────────────

describe('SubjectPeriodGrade.assignGrade', () => {
  it('sets grade fields and returns ok result', () => {
    const spg = SubjectPeriodGrade.create(BASE_INPUT);

    const result = spg.assignGrade({
      gradeScaleValueId: 'sv-uuid-1',
      gradeCode: 'MB',
      internalStatus: 'APROBADO',
    });

    expect(result.isOk()).toBe(true);
    expect(spg.gradeScaleValueId).toBe('sv-uuid-1');
    expect(spg.gradeCode).toBe('MB');
    expect(spg.internalStatus).toBe('APROBADO');
  });

  it('returns err(ValidationError) when gradeCode is empty string', () => {
    const spg = SubjectPeriodGrade.create(BASE_INPUT);

    const result = spg.assignGrade({
      gradeScaleValueId: 'sv-uuid-1',
      gradeCode: '',
      internalStatus: 'APROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  it('returns err(ValidationError) when gradeCode is whitespace only', () => {
    const spg = SubjectPeriodGrade.create(BASE_INPUT);

    const result = spg.assignGrade({
      gradeScaleValueId: 'sv-uuid-1',
      gradeCode: '  ',
      internalStatus: 'APROBADO',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ValidationError);
  });

  it('does NOT mutate grade fields on validation error', () => {
    const spg = SubjectPeriodGrade.reconstruct({
      id: 'spg-uuid-1',
      studentId: 'student-uuid-1',
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subj-uuid-1',
      periodOrdinal: 1,
      gradeScaleValueId: 'old-sv',
      gradeCode: 'OLD',
      internalStatus: 'APROBADO',
      pa: false,
      ppi: false,
      pp: false,
    });

    spg.assignGrade({ gradeScaleValueId: 'new-sv', gradeCode: '', internalStatus: 'NO_APROBADO' });

    expect(spg.gradeScaleValueId).toBe('old-sv');
    expect(spg.gradeCode).toBe('OLD');
  });
});

// ─── clearGrade ──────────────────────────────────────────────────────────────

describe('SubjectPeriodGrade.clearGrade', () => {
  it('nulls all three grade fields', () => {
    const spg = SubjectPeriodGrade.reconstruct({
      id: 'spg-uuid-1',
      studentId: 'student-uuid-1',
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subj-uuid-1',
      periodOrdinal: 1,
      gradeScaleValueId: 'sv-uuid-1',
      gradeCode: 'MB',
      internalStatus: 'APROBADO',
      pa: false,
      ppi: false,
      pp: false,
    });

    const result = spg.clearGrade();

    expect(result.isOk()).toBe(true);
    expect(spg.gradeScaleValueId).toBeNull();
    expect(spg.gradeCode).toBeNull();
    expect(spg.internalStatus).toBeNull();
  });

  it('does NOT clear flags when clearing grade', () => {
    const spg = SubjectPeriodGrade.reconstruct({
      id: 'spg-uuid-1',
      studentId: 'student-uuid-1',
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subj-uuid-1',
      periodOrdinal: 1,
      gradeScaleValueId: 'sv-uuid-1',
      gradeCode: 'MB',
      internalStatus: 'APROBADO',
      pa: true,
      ppi: false,
      pp: true,
    });

    spg.clearGrade();

    expect(spg.pa).toBe(true);
    expect(spg.ppi).toBe(false);
    expect(spg.pp).toBe(true);
  });
});

// ─── setFlags (PPF-R1, PPF-R4) ───────────────────────────────────────────────

describe('SubjectPeriodGrade.setFlags', () => {
  it('setFlags({pa:true}) sets pa=true, ppi and pp remain false', () => {
    const spg = SubjectPeriodGrade.create(BASE_INPUT);

    const result = spg.setFlags({ pa: true });

    expect(result.isOk()).toBe(true);
    expect(spg.pa).toBe(true);
    expect(spg.ppi).toBe(false);
    expect(spg.pp).toBe(false);
  });

  it('setFlags({ppi:true}) sets ppi=true, pa and pp remain false', () => {
    const spg = SubjectPeriodGrade.create(BASE_INPUT);

    spg.setFlags({ ppi: true });

    expect(spg.pa).toBe(false);
    expect(spg.ppi).toBe(true);
    expect(spg.pp).toBe(false);
  });

  it('setFlags({pp:true}) sets pp=true, pa and ppi remain false', () => {
    const spg = SubjectPeriodGrade.create(BASE_INPUT);

    spg.setFlags({ pp: true });

    expect(spg.pa).toBe(false);
    expect(spg.ppi).toBe(false);
    expect(spg.pp).toBe(true);
  });

  it('omitted flags retain their prior value (PPF-R4)', () => {
    const spg = SubjectPeriodGrade.reconstruct({
      id: 'spg-uuid-1',
      studentId: 'student-uuid-1',
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subj-uuid-1',
      periodOrdinal: 1,
      gradeScaleValueId: null,
      gradeCode: null,
      internalStatus: null,
      pa: true,
      ppi: false,
      pp: false,
    });

    // Set only pp=true — pa and ppi must not change
    spg.setFlags({ pp: true });

    expect(spg.pa).toBe(true);
    expect(spg.ppi).toBe(false);
    expect(spg.pp).toBe(true);
  });

  it('all flags toggleable independently — all three can be set at once', () => {
    const spg = SubjectPeriodGrade.create(BASE_INPUT);

    spg.setFlags({ pa: true, ppi: true, pp: true });

    expect(spg.pa).toBe(true);
    expect(spg.ppi).toBe(true);
    expect(spg.pp).toBe(true);
  });

  it('setFlags returns ok result', () => {
    const spg = SubjectPeriodGrade.create(BASE_INPUT);
    const result = spg.setFlags({ pa: true });
    expect(result.isOk()).toBe(true);
  });
});
