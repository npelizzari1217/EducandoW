/**
 * PR-2 [RED] — grading-phase-utils.
 * Shared gating helpers consumed by subject-grading-by-course.tsx and
 * subject-grading-by-subject.tsx to disable columns outside the active phase.
 * Specs: AC-A-5..AC-A-9 (spec #1645).
 */
import { describe, it, expect } from 'vitest';
import {
  isPeriodGradeEditable,
  isFinalGradeEditable,
  GRADING_PHASE_OPTIONS,
  GRADING_PHASE_LABELS,
} from '../grading-phase-utils';

describe('isPeriodGradeEditable', () => {
  it('NULL blocks every period (cutover duro)', () => {
    expect(isPeriodGradeEditable(null, 1)).toBe(false);
    expect(isPeriodGradeEditable(null, 4)).toBe(false);
  });

  it('BIM_n allows only ordinal n', () => {
    expect(isPeriodGradeEditable('BIM_2', 2)).toBe(true);
    expect(isPeriodGradeEditable('BIM_2', 1)).toBe(false);
    expect(isPeriodGradeEditable('BIM_2', 3)).toBe(false);
    expect(isPeriodGradeEditable('BIM_2', 4)).toBe(false);
  });

  it('CIERRE blocks every bimester period', () => {
    expect(isPeriodGradeEditable('CIERRE', 1)).toBe(false);
    expect(isPeriodGradeEditable('CIERRE', 4)).toBe(false);
  });
});

describe('isFinalGradeEditable', () => {
  it('only CIERRE allows special grades', () => {
    expect(isFinalGradeEditable('CIERRE')).toBe(true);
    expect(isFinalGradeEditable(null)).toBe(false);
    expect(isFinalGradeEditable('BIM_1')).toBe(false);
    expect(isFinalGradeEditable('BIM_4')).toBe(false);
  });
});

describe('GRADING_PHASE_OPTIONS / GRADING_PHASE_LABELS', () => {
  it('exposes exactly the 5 activatable phases (BIM_1..4 + CIERRE)', () => {
    expect(GRADING_PHASE_OPTIONS).toEqual(['BIM_1', 'BIM_2', 'BIM_3', 'BIM_4', 'CIERRE']);
  });

  it('has a Spanish label for every option', () => {
    for (const code of GRADING_PHASE_OPTIONS) {
      expect(GRADING_PHASE_LABELS[code]).toBeTruthy();
    }
  });
});
