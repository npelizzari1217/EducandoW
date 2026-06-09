/**
 * PR1-T1 [RED] — SubjectGradingPeriod entity tests.
 * Specs: SPG-R2, AD-4
 */
import { describe, it, expect } from 'vitest';
import { SubjectGradingPeriod } from './subject-grading-period';
import { ValidationError } from '../../shared/errors/validation-error';

describe('SubjectGradingPeriod.snapshotFromTemplateItem', () => {
  it('creates a valid entity from a template item with sortOrder=1 and a non-empty name', () => {
    const sgp = SubjectGradingPeriod.snapshotFromTemplateItem({
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subj-uuid-1',
      sortOrder: 1,
      name: '1° Trimestre',
    });

    expect(sgp.courseCycleId).toBe('cc-uuid-1');
    expect(sgp.subjectId).toBe('subj-uuid-1');
    expect(sgp.periodOrdinal).toBe(1);
    expect(sgp.periodName).toBe('1° Trimestre');
    expect(sgp.id).toHaveLength(36);
  });

  it('trims whitespace from periodName', () => {
    const sgp = SubjectGradingPeriod.snapshotFromTemplateItem({
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subj-uuid-1',
      sortOrder: 2,
      name: '  2° Trimestre  ',
    });

    expect(sgp.periodName).toBe('2° Trimestre');
  });

  it('throws ValidationError when periodOrdinal < 1 (sortOrder = 0)', () => {
    expect(() =>
      SubjectGradingPeriod.snapshotFromTemplateItem({
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-uuid-1',
        sortOrder: 0,
        name: 'Period',
      }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when sortOrder is negative', () => {
    expect(() =>
      SubjectGradingPeriod.snapshotFromTemplateItem({
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-uuid-1',
        sortOrder: -1,
        name: 'Period',
      }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when periodName is empty string', () => {
    expect(() =>
      SubjectGradingPeriod.snapshotFromTemplateItem({
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-uuid-1',
        sortOrder: 1,
        name: '',
      }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when periodName is whitespace only', () => {
    expect(() =>
      SubjectGradingPeriod.snapshotFromTemplateItem({
        courseCycleId: 'cc-uuid-1',
        subjectId: 'subj-uuid-1',
        sortOrder: 1,
        name: '   ',
      }),
    ).toThrow(ValidationError);
  });
});

describe('SubjectGradingPeriod.reconstruct', () => {
  it('reconstructs from stored props', () => {
    const sgp = SubjectGradingPeriod.reconstruct({
      id: 'existing-uuid',
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subj-uuid-1',
      periodOrdinal: 3,
      periodName: '3° Trimestre',
    });

    expect(sgp.id).toBe('existing-uuid');
    expect(sgp.periodOrdinal).toBe(3);
    expect(sgp.periodName).toBe('3° Trimestre');
  });
});

describe('SubjectGradingPeriod immutability', () => {
  it('has no mutating methods (entity is immutable after creation)', () => {
    const sgp = SubjectGradingPeriod.snapshotFromTemplateItem({
      courseCycleId: 'cc-uuid-1',
      subjectId: 'subj-uuid-1',
      sortOrder: 1,
      name: '1° Trimestre',
    });

    // Only getters exist — no setter methods exposed
    expect(typeof (sgp as any).setPeriodName).toBe('undefined');
    expect(typeof (sgp as any).setPeriodOrdinal).toBe('undefined');
  });
});
