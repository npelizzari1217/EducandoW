/**
 * PR-2 [GREEN] — Shared gating helpers for the grading phase (Capacidad A).
 *
 * The active `gradingPhase` on a CourseCycle drives which columns are editable
 * in the grading grids (subject-grading-by-course.tsx / subject-grading-by-subject.tsx):
 *   - NULL   → blocks every bimester period AND every special/final grade (cutover duro).
 *   - BIM_n  → allows ONLY period n; blocks every other period and every final grade.
 *   - CIERRE → blocks every bimester period; allows ONLY special/final grades.
 *
 * Mirrors CourseCycle.canGradeBimester()/canGradeFinal() on the domain side
 * (packages/domain/src/course-cycle/entities/course-cycle.ts) — kept in sync
 * so the front never shows an editable control the backend would reject.
 * Specs: AC-A-5..AC-A-9 (spec #1645).
 */

export type GradingPhaseValue = 'BIM_1' | 'BIM_2' | 'BIM_3' | 'BIM_4' | 'CIERRE' | null;

/** The 5 activatable phases (excludes NULL — NULL is a state, not a selectable option). */
export const GRADING_PHASE_OPTIONS = ['BIM_1', 'BIM_2', 'BIM_3', 'BIM_4', 'CIERRE'] as const;

export const GRADING_PHASE_LABELS: Record<(typeof GRADING_PHASE_OPTIONS)[number], string> = {
  BIM_1: '1er Bimestre',
  BIM_2: '2do Bimestre',
  BIM_3: '3er Bimestre',
  BIM_4: '4to Bimestre',
  CIERRE: 'Cierre',
};

/** Human-readable label for the current phase, including the null ("sin activar") state. */
export function gradingPhaseStatusLabel(gradingPhase: GradingPhaseValue): string {
  if (gradingPhase === null) return 'Sin fase activada';
  return GRADING_PHASE_LABELS[gradingPhase];
}

/** BIM_n allows only period n; NULL and CIERRE block every bimester period. */
export function isPeriodGradeEditable(gradingPhase: GradingPhaseValue, periodOrdinal: number): boolean {
  return gradingPhase === `BIM_${periodOrdinal}`;
}

/** Only CIERRE allows special/final grades (FINAL/DICIEMBRE/MARZO/DEFINITIVA). */
export function isFinalGradeEditable(gradingPhase: GradingPhaseValue): boolean {
  return gradingPhase === 'CIERRE';
}
