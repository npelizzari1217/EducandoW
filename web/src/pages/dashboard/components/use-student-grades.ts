/**
 * PR6-T2 [GREEN] — useStudentGrades hook.
 *
 * Single data source for the SubjectGradingByCourse ("Alumnos por Curso") page.
 * Called ONCE at the top of the inner StudentGradingGrid — W1 avoidance:
 *   - No second useGradingGrid call (CompetencyGradingGrid not used here —
 *     incompatible props for by-student view; competency data comes from the
 *     by-student endpoint itself).
 *
 * Fetches (parallel on (courseCycleId, studentId) change):
 *   GET /grading/subject-grades/by-student?courseCycleId=&studentId=
 *   GET /grading/scales?level=&modality=
 *
 * Provides updatePeriodGrade, updateFinalGrade, updateImprimible with optimistic
 * UI and inline save (PUT / PATCH).
 *
 * Specs: ES-R2 (CORRECTED), ES-R5, ES-R7, ES-R8, ES-R10
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../../../api/client';
import type { ScaleValue } from './use-grading-grid';

// ── Raw API shapes (source: get-subject-grades-by-student.use-case.ts) ─────────

interface RawPeriodGrade {
  periodOrdinal: number;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: string | null;
  pa: boolean;
  ppi: boolean;
  pp: boolean;
}

interface RawFinalGrade {
  type: string;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: string | null;
  passed: boolean | null;
}

interface RawPeriodValuation {
  periodItemId: string;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: string | null;
  modificable: boolean;
  imprimible: boolean;
}

interface RawCompetencyValuation {
  valuationId: string;
  studentId: string;
  competencyId: string;
  competencyName: string;
  periodValuations: RawPeriodValuation[];
}

interface RawSubjectEntry {
  subjectId: string;
  subjectName: string;
  periods: Array<{ periodOrdinal: number; periodName: string }>;
  periodGrades: RawPeriodGrade[];
  finalGrades: RawFinalGrade[];
  competencyValuations: RawCompetencyValuation[];
}

interface RawByStudentResponse {
  courseCycleId: string;
  studentId: string;
  subjects: RawSubjectEntry[];
}

// ── Stateful shapes (adds saveState per mutable cell) ──────────────────────────

export interface PeriodGradeState extends RawPeriodGrade {
  saveState: 'idle' | 'saving' | 'error';
}

export interface FinalGradeState extends RawFinalGrade {
  saveState: 'idle' | 'saving' | 'error';
}

export interface CompetencyPeriodState extends RawPeriodValuation {
  saveState: 'idle' | 'saving' | 'error';
}

export interface CompetencyValuationState {
  valuationId: string;
  competencyId: string;
  competencyName: string;
  periodValuations: CompetencyPeriodState[];
}

export interface SubjectWithState {
  subjectId: string;
  subjectName: string;
  periods: Array<{ periodOrdinal: number; periodName: string }>;
  periodGrades: PeriodGradeState[];
  finalGrades: FinalGradeState[];
  competencyValuations: CompetencyValuationState[];
}

// ── Options / Return ───────────────────────────────────────────────────────────

export interface StudentGradesOptions {
  courseCycleId: string;
  studentId: string;
  level: number;
  modality: number | null;
}

export interface UseStudentGradesReturn {
  loading: boolean;
  error: string;
  subjects: SubjectWithState[];
  scaleValues: ScaleValue[];
  updatePeriodGrade(subjectId: string, periodOrdinal: number, updates: Partial<PeriodGradeState>): void;
  updateFinalGrade(subjectId: string, type: string, updates: Partial<FinalGradeState>): void;
  updateImprimible(valuationId: string, periodItemId: string, imprimible: boolean): void;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useStudentGrades({
  courseCycleId,
  studentId,
  level,
  modality,
}: StudentGradesOptions): UseStudentGradesReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subjects, setSubjects] = useState<SubjectWithState[]>([]);
  const [scaleValues, setScaleValues] = useState<ScaleValue[]>([]);

  // Ref for sync reads in update callbacks
  const subjectsRef = useRef<SubjectWithState[]>([]);
  subjectsRef.current = subjects;

  // ── Fetch on (courseCycleId, studentId) change ────────────────────────────
  useEffect(() => {
    if (!courseCycleId || !studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const scaleParams: Record<string, string> = { level: String(level) };
    if (modality !== null && modality !== undefined) {
      scaleParams.modality = String(modality);
    }

    Promise.allSettled([
      apiClient.get('/grading/subject-grades/by-student', {
        params: { courseCycleId, studentId },
      }),
      apiClient.get('/grading/scales', { params: scaleParams }),
    ]).then(([byStudentRes, scalesRes]) => {
      // ── Subject grades + competency valuations ────────────────────────────
      const byStudentData: RawByStudentResponse | null =
        byStudentRes.status === 'fulfilled'
          ? ((byStudentRes.value as { data: { data: RawByStudentResponse } }).data?.data ?? null)
          : null;

      const rawSubjects: RawSubjectEntry[] = byStudentData?.subjects ?? [];

      const newSubjects: SubjectWithState[] = rawSubjects.map((s) => ({
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        periods: s.periods ?? [],
        periodGrades: (s.periodGrades ?? []).map((g) => ({ ...g, saveState: 'idle' as const })),
        finalGrades: (s.finalGrades ?? []).map((f) => ({ ...f, saveState: 'idle' as const })),
        competencyValuations: (s.competencyValuations ?? []).map((cv) => ({
          valuationId: cv.valuationId,
          competencyId: cv.competencyId,
          competencyName: cv.competencyName,
          periodValuations: (cv.periodValuations ?? []).map((pv) => ({
            ...pv,
            saveState: 'idle' as const,
          })),
        })),
      }));

      // ── Scale values (for grade dropdowns) ───────────────────────────────
      const scales =
        scalesRes.status === 'fulfilled'
          ? ((scalesRes.value as { data: { data: unknown[] } }).data?.data ?? [])
          : [];
      const allValues: ScaleValue[] = (scales as Array<{ values?: ScaleValue[] }>)
        .flatMap((s) => s.values ?? [])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      setSubjects(newSubjects);
      setScaleValues(allValues);
      setLoading(false);
    }).catch(() => {
      setError('Error al cargar los datos del alumno');
      setLoading(false);
    });
  }, [courseCycleId, studentId, level, modality]);

  // ── updatePeriodGrade: optimistic + PUT ──────────────────────────────────

  const updatePeriodGrade = useCallback(
    (subjectId: string, periodOrdinal: number, updates: Partial<PeriodGradeState>) => {
      // Read current cell for merge
      const currentSubject = subjectsRef.current.find((s) => s.subjectId === subjectId);
      const currentGrade = currentSubject?.periodGrades.find((g) => g.periodOrdinal === periodOrdinal);
      const merged: PeriodGradeState = {
        periodOrdinal,
        gradeScaleValueId: null,
        gradeCode: null,
        internalStatus: null,
        pa: false,
        ppi: false,
        pp: false,
        saveState: 'saving',
        ...currentGrade,
        ...updates,
      };

      // Optimistic update
      setSubjects((prev) =>
        prev.map((s) => {
          if (s.subjectId !== subjectId) return s;
          const hasPG = s.periodGrades.some((g) => g.periodOrdinal === periodOrdinal);
          const newPGs = hasPG
            ? s.periodGrades.map((g) =>
                g.periodOrdinal === periodOrdinal ? { ...g, ...updates, saveState: 'saving' as const } : g,
              )
            : [...s.periodGrades, { ...merged, saveState: 'saving' as const }];
          return { ...s, periodGrades: newPGs };
        }),
      );

      apiClient
        .put('/grading/subject-grades', {
          items: [
            {
              courseCycleId,
              subjectId,
              studentId,
              periodOrdinal: merged.periodOrdinal,
              gradeScaleValueId: merged.gradeScaleValueId ?? null,
              pa: merged.pa ?? false,
              ppi: merged.ppi ?? false,
              pp: merged.pp ?? false,
            },
          ],
        })
        .then(() => {
          setSubjects((prev) =>
            prev.map((s) => {
              if (s.subjectId !== subjectId) return s;
              return {
                ...s,
                periodGrades: s.periodGrades.map((g) =>
                  g.periodOrdinal === periodOrdinal ? { ...g, saveState: 'idle' as const } : g,
                ),
              };
            }),
          );
        })
        .catch(() => {
          setSubjects((prev) =>
            prev.map((s) => {
              if (s.subjectId !== subjectId) return s;
              return {
                ...s,
                periodGrades: s.periodGrades.map((g) =>
                  g.periodOrdinal === periodOrdinal ? { ...g, saveState: 'error' as const } : g,
                ),
              };
            }),
          );
        });
    },
    [courseCycleId, studentId],
  );

  // ── updateFinalGrade: optimistic + PUT ───────────────────────────────────

  const updateFinalGrade = useCallback(
    (subjectId: string, type: string, updates: Partial<FinalGradeState>) => {
      const currentSubject = subjectsRef.current.find((s) => s.subjectId === subjectId);
      const currentGrade = currentSubject?.finalGrades.find((f) => f.type === type);
      const merged: FinalGradeState = {
        type,
        gradeScaleValueId: null,
        gradeCode: null,
        internalStatus: null,
        passed: null,
        saveState: 'saving',
        ...currentGrade,
        ...updates,
      };

      setSubjects((prev) =>
        prev.map((s) => {
          if (s.subjectId !== subjectId) return s;
          const hasFG = s.finalGrades.some((f) => f.type === type);
          const newFGs = hasFG
            ? s.finalGrades.map((f) =>
                f.type === type ? { ...f, ...updates, saveState: 'saving' as const } : f,
              )
            : [...s.finalGrades, { ...merged, saveState: 'saving' as const }];
          return { ...s, finalGrades: newFGs };
        }),
      );

      apiClient
        .put('/grading/subject-final-grades', {
          items: [
            {
              courseCycleId,
              subjectId,
              studentId,
              type: merged.type,
              // null rejected by DTO — use undefined to omit (W1-C3 pattern)
              gradeScaleValueId: merged.gradeScaleValueId ?? undefined,
              passed: merged.passed ?? undefined,
            },
          ],
        })
        .then(() => {
          setSubjects((prev) =>
            prev.map((s) => {
              if (s.subjectId !== subjectId) return s;
              return {
                ...s,
                finalGrades: s.finalGrades.map((f) =>
                  f.type === type ? { ...f, saveState: 'idle' as const } : f,
                ),
              };
            }),
          );
        })
        .catch(() => {
          setSubjects((prev) =>
            prev.map((s) => {
              if (s.subjectId !== subjectId) return s;
              return {
                ...s,
                finalGrades: s.finalGrades.map((f) =>
                  f.type === type ? { ...f, saveState: 'error' as const } : f,
                ),
              };
            }),
          );
        });
    },
    [courseCycleId, studentId],
  );

  // ── updateImprimible: optimistic + PATCH ─────────────────────────────────

  const updateImprimible = useCallback(
    (valuationId: string, periodItemId: string, imprimible: boolean) => {
      // Optimistic update
      setSubjects((prev) =>
        prev.map((s) => ({
          ...s,
          competencyValuations: s.competencyValuations.map((cv) => {
            if (cv.valuationId !== valuationId) return cv;
            return {
              ...cv,
              periodValuations: cv.periodValuations.map((pv) =>
                pv.periodItemId === periodItemId
                  ? { ...pv, imprimible, saveState: 'saving' as const }
                  : pv,
              ),
            };
          }),
        })),
      );

      apiClient
        .patch(`/competency-valuations/${valuationId}/periods/${periodItemId}`, { imprimible })
        .then(() => {
          setSubjects((prev) =>
            prev.map((s) => ({
              ...s,
              competencyValuations: s.competencyValuations.map((cv) => {
                if (cv.valuationId !== valuationId) return cv;
                return {
                  ...cv,
                  periodValuations: cv.periodValuations.map((pv) =>
                    pv.periodItemId === periodItemId
                      ? { ...pv, saveState: 'idle' as const }
                      : pv,
                  ),
                };
              }),
            })),
          );
        })
        .catch(() => {
          setSubjects((prev) =>
            prev.map((s) => ({
              ...s,
              competencyValuations: s.competencyValuations.map((cv) => {
                if (cv.valuationId !== valuationId) return cv;
                return {
                  ...cv,
                  periodValuations: cv.periodValuations.map((pv) =>
                    pv.periodItemId === periodItemId
                      ? { ...pv, saveState: 'error' as const }
                      : pv,
                  ),
                };
              }),
            })),
          );
        });
    },
    [],
  );

  return {
    loading,
    error,
    subjects,
    scaleValues,
    updatePeriodGrade,
    updateFinalGrade,
    updateImprimible,
  };
}
