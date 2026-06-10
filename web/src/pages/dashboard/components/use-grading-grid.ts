import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../../../api/client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CellState {
  valuationId: string;
  studentId: string;
  competencyId: string;
  periodItemId: string;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: string | null;
  modificable: boolean;
  imprimible: boolean;
  saveState: 'idle' | 'dirty' | 'saving' | 'error';
}

export interface EnrolledStudent {
  studentId: string;
  firstName: string;
  lastName: string;
}

export interface SubjectCompetency {
  uuid: string;
  studyPlanSubjectId: string;
  name: string;
  active: boolean;
  imprimible?: boolean;
}

export interface PeriodItem {
  id: string;
  name: string;
  sort_order: number;
}

export interface ScaleValue {
  id: string;
  code: string;
  label: string;
  internal_status: string | null;
  sort_order: number;
}

export interface SubjectGradingPeriod {
  periodOrdinal: number;
  periodName: string;
}

export interface SubjectPeriodGradeCell {
  studentId: string;
  periodOrdinal: number;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: string | null;
  pa: boolean;
  ppi: boolean;
  pp: boolean;
  saveState: 'idle' | 'dirty' | 'saving' | 'error';
}

export interface SubjectFinalGradeCell {
  studentId: string;
  type: string;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: string | null;
  passed: boolean | null;
  /** Year-end verdict (REGULAR | PREVIA | LIBRE). Only sent for the FINAL row. */
  condicion?: string;
  saveState: 'idle' | 'dirty' | 'saving' | 'error';
}

interface RawPeriodValuation {
  periodItemId: string;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: string | null;
  modificable: boolean;
  imprimible: boolean;
}

interface RawValuation {
  valuationId: string;
  studentId: string;
  competencyId: string;
  periodValuations: RawPeriodValuation[];
}

interface RawSubjectGradePeriod {
  periodOrdinal: number;
  periodName: string;
}

interface RawSubjectPeriodGrade {
  periodOrdinal: number;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: string | null;
  pa: boolean;
  ppi: boolean;
  pp: boolean;
}

interface RawSubjectFinalGrade {
  type: string;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: string | null;
  passed: boolean | null;
  /** condicion from PR5 — null for Primario rows (column is nullable in DB) */
  condicion?: string | null;
}

interface RawSubjectGradeStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  periodGrades: RawSubjectPeriodGrade[];
  finalGrades: RawSubjectFinalGrade[];
  /** CompetencyValuationWithPeriods[] — imprimible lives on each periodValuation */
  competencyValuations: Array<{
    valuationId: string;
    studentId: string;
    competencyId: string;
    periodValuations: Array<{
      periodItemId: string;
      gradeScaleValueId: string | null;
      gradeCode: string | null;
      internalStatus: string | null;
      modificable: boolean;
      imprimible: boolean;
    }>;
  }>;
}

interface RawSubjectGradesData {
  periods: RawSubjectGradePeriod[];
  students: RawSubjectGradeStudent[];
  // NOTE: no top-level competencies[] — imprimible is in students[].competencyValuations[].periodValuations[]
}

export interface GradingGridOptions {
  courseCycleId: string;
  studyPlanSubjectId: string;
  level: number;
  modality: number | null;
  subjectId?: string;
}

export interface UseGradingGridReturn {
  // ── Existing competency channel ──────────────────────────────────────────────
  loading: boolean;
  error: string;
  students: EnrolledStudent[];
  competencies: SubjectCompetency[];
  periodItems: PeriodItem[];
  scaleValues: ScaleValue[];
  activePeriodItemId: string | null;
  cells: Map<string, CellState>;
  switchPeriod: (periodItemId: string) => void;
  updateCell: (cellKey: string, gradeScaleValueId: string) => void;
  updateImprimible: (cellKey: string, imprimible: boolean) => void;
  saveAll: () => Promise<void>;
  isSavingAll: boolean;
  // ── Subject-grade channels (activated when subjectId is provided) ─────────────
  subjectGradePeriods: SubjectGradingPeriod[];
  subjectPeriodGradeCells: Map<string, SubjectPeriodGradeCell>;
  subjectFinalGradeCells: Map<string, SubjectFinalGradeCell>;
  updateSubjectPeriodGrade: (cellKey: string, updates: Partial<SubjectPeriodGradeCell>) => void;
  updateSubjectFinalGrade: (cellKey: string, updates: Partial<SubjectFinalGradeCell>) => void;
  saveSubjectGrades: () => Promise<void>;
  saveSubjectFinalGrades: () => Promise<void>;
  isSavingSubjectGrades: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useGradingGrid({
  courseCycleId,
  studyPlanSubjectId,
  level,
  modality,
  subjectId,
}: GradingGridOptions): UseGradingGridReturn {
  // ── Existing competency channel state ─────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [competencies, setCompetencies] = useState<SubjectCompetency[]>([]);
  const [periodItems, setPeriodItems] = useState<PeriodItem[]>([]);
  const [scaleValues, setScaleValues] = useState<ScaleValue[]>([]);
  const [activePeriodItemId, setActivePeriodItemId] = useState<string | null>(null);
  const [cells, setCells] = useState<Map<string, CellState>>(new Map());
  const [isSavingAll, setIsSavingAll] = useState(false);

  // ── Subject-grade channel state ───────────────────────────────────────────────
  const [subjectGradePeriods, setSubjectGradePeriods] = useState<SubjectGradingPeriod[]>([]);
  const [subjectPeriodGradeCells, setSubjectPeriodGradeCells] = useState<Map<string, SubjectPeriodGradeCell>>(new Map());
  const [subjectFinalGradeCells, setSubjectFinalGradeCells] = useState<Map<string, SubjectFinalGradeCell>>(new Map());
  const [isSavingSubjectGrades, setIsSavingSubjectGrades] = useState(false);

  // Keep refs in sync for async reads in save functions
  const cellsRef = useRef<Map<string, CellState>>(new Map());
  cellsRef.current = cells;

  const subjectPeriodGradeCellsRef = useRef<Map<string, SubjectPeriodGradeCell>>(new Map());
  subjectPeriodGradeCellsRef.current = subjectPeriodGradeCells;

  const subjectFinalGradeCellsRef = useRef<Map<string, SubjectFinalGradeCell>>(new Map());
  subjectFinalGradeCellsRef.current = subjectFinalGradeCells;

  useEffect(() => {
    if (!courseCycleId || !studyPlanSubjectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const templateParams: Record<string, string> = { level: String(level) };
    if (modality !== null && modality !== undefined) {
      templateParams.modality = String(modality);
    }

    const baseFetches: Promise<unknown>[] = [
      apiClient.get(`/course-cycles/${courseCycleId}/students`),
      apiClient.get('/subject-competencies', { params: { studyPlanSubjectId } }),
      apiClient.get('/grading/period-templates', { params: templateParams }),
      apiClient.get('/grading/scales', { params: templateParams }),
      apiClient.get('/competency-valuations', { params: { courseCycleId, studyPlanSubjectId } }),
    ];

    // Add subject-grades channel when subjectId is provided
    const subjectGradesFetch = subjectId
      ? apiClient.get('/grading/subject-grades', { params: { courseCycleId, subjectId } })
      : null;

    if (subjectGradesFetch) {
      baseFetches.push(subjectGradesFetch);
    }

    Promise.allSettled(baseFetches).then((results) => {
      const [studentsRes, compRes, periodsRes, scalesRes, valuationsRes, subjectGradesRes] = results;

      const studentsData: EnrolledStudent[] =
        studentsRes.status === 'fulfilled' ? (studentsRes.value as { data: { data: EnrolledStudent[] } }).data?.data ?? [] : [];

      const compData: SubjectCompetency[] =
        compRes.status === 'fulfilled' ? (compRes.value as { data: { data: SubjectCompetency[] } }).data?.data ?? [] : [];

      // Flatten period items from all matching templates, sort by sort_order
      const templates = periodsRes.status === 'fulfilled' ? (periodsRes.value as { data: { data: unknown[] } }).data?.data ?? [] : [];
      const allItems: PeriodItem[] = (templates as Array<{ items?: PeriodItem[] }>)
        .flatMap((t) => t.items ?? [])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      // Flatten scale values from all matching scales, sort by sort_order
      const scales = scalesRes.status === 'fulfilled' ? (scalesRes.value as { data: { data: unknown[] } }).data?.data ?? [] : [];
      const allValues: ScaleValue[] = (scales as Array<{ values?: ScaleValue[] }>)
        .flatMap((s) => s.values ?? [])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const valuations: RawValuation[] =
        valuationsRes.status === 'fulfilled' ? (valuationsRes.value as { data: { data: RawValuation[] } }).data?.data ?? [] : [];

      // Build dense cells Map: every valuation × every period item
      const cellsMap = new Map<string, CellState>();
      for (const val of valuations) {
        for (const item of allItems) {
          const pv = val.periodValuations.find((p) => p.periodItemId === item.id);
          cellsMap.set(`${val.valuationId}:${item.id}`, {
            valuationId: val.valuationId,
            studentId: val.studentId,
            competencyId: val.competencyId,
            periodItemId: item.id,
            gradeScaleValueId: pv?.gradeScaleValueId ?? null,
            gradeCode: pv?.gradeCode ?? null,
            internalStatus: pv?.internalStatus ?? null,
            modificable: pv?.modificable ?? true,
            imprimible: pv?.imprimible ?? false,
            saveState: 'idle',
          });
        }
      }

      // ── Process subject-grades channel ──────────────────────────────────────
      let mergedCompetencies = compData;
      let newSubjectGradePeriods: SubjectGradingPeriod[] = [];
      const newSubjectPeriodGradeCells = new Map<string, SubjectPeriodGradeCell>();
      const newSubjectFinalGradeCells = new Map<string, SubjectFinalGradeCell>();

      if (subjectId && subjectGradesRes && subjectGradesRes.status === 'fulfilled') {
        const sgData: RawSubjectGradesData =
          (subjectGradesRes.value as { data: { data: RawSubjectGradesData } }).data?.data ?? {
            periods: [],
            students: [],
          };

        newSubjectGradePeriods = sgData.periods ?? [];

        // Derive imprimible per competency from students[].competencyValuations[].periodValuations[].imprimible
        // The real API has no top-level competencies[]; imprimible is on each period valuation.
        const sgCompMap = new Map<string, boolean>();
        for (const student of (sgData.students ?? [])) {
          for (const cv of (student.competencyValuations ?? [])) {
            if (!sgCompMap.has(cv.competencyId)) {
              sgCompMap.set(cv.competencyId, cv.periodValuations.some((pv) => pv.imprimible));
            }
          }
        }
        mergedCompetencies = compData.map((c) => ({
          ...c,
          imprimible: sgCompMap.has(c.uuid) ? sgCompMap.get(c.uuid)! : undefined,
        }));

        // Build period grade cells and final grade cells
        for (const student of (sgData.students ?? [])) {
          for (const pg of (student.periodGrades ?? [])) {
            const key = `${student.studentId}:${pg.periodOrdinal}`;
            newSubjectPeriodGradeCells.set(key, {
              studentId: student.studentId,
              periodOrdinal: pg.periodOrdinal,
              gradeScaleValueId: pg.gradeScaleValueId,
              gradeCode: pg.gradeCode,
              internalStatus: pg.internalStatus,
              pa: pg.pa,
              ppi: pg.ppi,
              pp: pg.pp,
              saveState: 'idle',
            });
          }
          for (const fg of (student.finalGrades ?? [])) {
            const key = `${student.studentId}:${fg.type}`;
            newSubjectFinalGradeCells.set(key, {
              studentId: student.studentId,
              type: fg.type,
              gradeScaleValueId: fg.gradeScaleValueId,
              gradeCode: fg.gradeCode,
              internalStatus: fg.internalStatus,
              passed: fg.passed,
              condicion: fg.condicion ?? undefined,
              saveState: 'idle',
            });
          }
        }
      }

      setStudents(studentsData);
      setCompetencies(mergedCompetencies);
      setPeriodItems(allItems);
      setScaleValues(allValues);
      setActivePeriodItemId(allItems[0]?.id ?? null);
      setCells(cellsMap);
      setSubjectGradePeriods(newSubjectGradePeriods);
      setSubjectPeriodGradeCells(newSubjectPeriodGradeCells);
      setSubjectFinalGradeCells(newSubjectFinalGradeCells);
      setLoading(false);
    }).catch(() => {
      setError('Error al cargar los datos de la grilla');
      setLoading(false);
    });
  }, [courseCycleId, studyPlanSubjectId, level, modality, subjectId]);

  // ── switchPeriod: updates activePeriodItemId, no refetch (CGG-2) ─────────────

  const switchPeriod = useCallback((periodItemId: string) => {
    setActivePeriodItemId(periodItemId);
  }, []);

  // ── updateCell: per-cell PATCH on dropdown change ─────────────────────────────

  const updateCell = useCallback((cellKey: string, gradeScaleValueId: string) => {
    const colonIdx = cellKey.indexOf(':');
    if (colonIdx === -1) return;
    const valuationId = cellKey.slice(0, colonIdx);
    const periodItemId = cellKey.slice(colonIdx + 1);

    // Optimistic: mark saving immediately
    setCells((prev) => {
      const cell = prev.get(cellKey);
      if (!cell || !cell.modificable) return prev;
      const next = new Map(prev);
      next.set(cellKey, { ...cell, gradeScaleValueId, saveState: 'saving' });
      return next;
    });

    apiClient
      .patch(`/competency-valuations/${valuationId}/periods/${periodItemId}`, { gradeScaleValueId })
      .then((res) => {
        const data = res.data?.data;
        setCells((prev) => {
          const cell = prev.get(cellKey);
          if (!cell) return prev;
          const next = new Map(prev);
          next.set(cellKey, {
            ...cell,
            gradeScaleValueId: data?.gradeScaleValueId ?? gradeScaleValueId,
            gradeCode: data?.gradeCode ?? null,
            internalStatus: data?.internalStatus ?? null,
            modificable: data?.modificable ?? cell.modificable,
            saveState: 'idle',
          });
          return next;
        });
      })
      .catch(() => {
        setCells((prev) => {
          const cell = prev.get(cellKey);
          if (!cell) return prev;
          const next = new Map(prev);
          next.set(cellKey, { ...cell, saveState: 'error' });
          return next;
        });
      });
  }, []);

  // ── updateImprimible: toggle imprimible per cell via PATCH ────────────────────

  const updateImprimible = useCallback((cellKey: string, imprimible: boolean) => {
    const colonIdx = cellKey.indexOf(':');
    if (colonIdx === -1) return;
    const valuationId = cellKey.slice(0, colonIdx);
    const periodItemId = cellKey.slice(colonIdx + 1);

    // Optimistic update
    setCells((prev) => {
      const cell = prev.get(cellKey);
      if (!cell) return prev;
      const next = new Map(prev);
      next.set(cellKey, { ...cell, imprimible, saveState: 'saving' });
      return next;
    });

    apiClient
      .patch(`/competency-valuations/${valuationId}/periods/${periodItemId}`, { imprimible })
      .then((res) => {
        const data = res.data?.data;
        setCells((prev) => {
          const cell = prev.get(cellKey);
          if (!cell) return prev;
          const next = new Map(prev);
          next.set(cellKey, {
            ...cell,
            imprimible: data?.imprimible !== undefined ? (data.imprimible as boolean) : imprimible,
            saveState: 'idle',
          });
          return next;
        });
      })
      .catch(() => {
        setCells((prev) => {
          const cell = prev.get(cellKey);
          if (!cell) return prev;
          const next = new Map(prev);
          next.set(cellKey, { ...cell, saveState: 'error' });
          return next;
        });
      });
  }, []);

  // ── saveAll: bounded-parallel allSettled (≤5 in-flight) D3 ────────────────────

  const saveAll = useCallback(async () => {
    const snapshot = [...cellsRef.current.entries()].filter(
      ([, c]) => c.saveState === 'dirty' || c.saveState === 'error',
    );
    if (snapshot.length === 0) return;

    setIsSavingAll(true);

    // Mark all as saving
    setCells((prev) => {
      const next = new Map(prev);
      for (const [key] of snapshot) {
        const c = next.get(key);
        if (c) next.set(key, { ...c, saveState: 'saving' });
      }
      return next;
    });

    // Process in batches of 5 (bounded parallel)
    for (let i = 0; i < snapshot.length; i += 5) {
      const batch = snapshot.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(([key, cell]) =>
          apiClient
            .patch(`/competency-valuations/${cell.valuationId}/periods/${cell.periodItemId}`, {
              gradeScaleValueId: cell.gradeScaleValueId,
            })
            .then((res) => ({ key, success: true, data: res.data?.data }))
            .catch(() => ({ key, success: false, data: null as null })),
        ),
      );

      setCells((prev) => {
        const next = new Map(prev);
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { key, success, data } = result.value;
            const current = next.get(key);
            if (current) {
              if (success) {
                next.set(key, {
                  ...current,
                  gradeCode: data?.gradeCode ?? current.gradeCode,
                  internalStatus: data?.internalStatus ?? current.internalStatus,
                  saveState: 'idle',
                });
              } else {
                next.set(key, { ...current, saveState: 'error' });
              }
            }
          }
        }
        return next;
      });
    }

    setIsSavingAll(false);
  }, []);

  // ── updateSubjectPeriodGrade: optimistic update + immediate PUT ───────────────

  const updateSubjectPeriodGrade = useCallback((cellKey: string, updates: Partial<SubjectPeriodGradeCell>) => {
    // Parse key: "${studentId}:${periodOrdinal}"
    const colonIdx = cellKey.indexOf(':');
    if (colonIdx === -1) return;
    const studentId = cellKey.slice(0, colonIdx);
    const periodOrdinal = parseInt(cellKey.slice(colonIdx + 1), 10);

    // Optimistic update
    setSubjectPeriodGradeCells((prev) => {
      const cell = prev.get(cellKey);
      if (!cell) return prev;
      const next = new Map(prev);
      next.set(cellKey, { ...cell, ...updates, saveState: 'saving' });
      return next;
    });

    // Get current cell to merge for the PUT body
    const currentCell = subjectPeriodGradeCellsRef.current.get(cellKey);
    const merged = { ...currentCell, ...updates };

    apiClient
      .put('/grading/subject-grades', {
        items: [{
          courseCycleId,
          subjectId,
          studentId,
          periodOrdinal,
          gradeScaleValueId: merged.gradeScaleValueId ?? null,
          pa: merged.pa ?? false,
          ppi: merged.ppi ?? false,
          pp: merged.pp ?? false,
        }],
      })
      .then((res) => {
        const data = res.data?.data;
        setSubjectPeriodGradeCells((prev) => {
          const cell = prev.get(cellKey);
          if (!cell) return prev;
          const next = new Map(prev);
          next.set(cellKey, {
            ...cell,
            gradeScaleValueId: data?.gradeScaleValueId ?? merged.gradeScaleValueId ?? null,
            gradeCode: data?.gradeCode ?? merged.gradeCode ?? null,
            internalStatus: data?.internalStatus ?? merged.internalStatus ?? null,
            saveState: 'idle',
          });
          return next;
        });
      })
      .catch(() => {
        setSubjectPeriodGradeCells((prev) => {
          const cell = prev.get(cellKey);
          if (!cell) return prev;
          const next = new Map(prev);
          next.set(cellKey, { ...cell, saveState: 'error' });
          return next;
        });
      });
  }, [courseCycleId, subjectId]);

  // ── updateSubjectFinalGrade: optimistic update + immediate PUT ────────────────

  const updateSubjectFinalGrade = useCallback((cellKey: string, updates: Partial<SubjectFinalGradeCell>) => {
    // Parse key: "${studentId}:${type}"
    const colonIdx = cellKey.indexOf(':');
    if (colonIdx === -1) return;
    const studentId = cellKey.slice(0, colonIdx);
    const type = cellKey.slice(colonIdx + 1);

    // Optimistic update
    setSubjectFinalGradeCells((prev) => {
      const cell = prev.get(cellKey);
      if (!cell) return prev;
      const next = new Map(prev);
      next.set(cellKey, { ...cell, ...updates, saveState: 'saving' });
      return next;
    });

    const currentCell = subjectFinalGradeCellsRef.current.get(cellKey);
    const merged = { ...currentCell, ...updates };

    apiClient
      .put('/grading/subject-final-grades', {
        items: [{
          courseCycleId,
          subjectId,
          studentId,
          type,
          // null is rejected by the DTO (z.string().min(1).optional()) — use undefined to omit
          gradeScaleValueId: merged.gradeScaleValueId ?? undefined,
          passed: merged.passed ?? undefined,
          // condicion: only included when set (undefined omits the field from the PUT body)
          ...(merged.condicion !== undefined ? { condicion: merged.condicion } : {}),
        }],
      })
      .then((res) => {
        const data = res.data?.data;
        setSubjectFinalGradeCells((prev) => {
          const cell = prev.get(cellKey);
          if (!cell) return prev;
          const next = new Map(prev);
          next.set(cellKey, {
            ...cell,
            gradeScaleValueId: data?.gradeScaleValueId ?? merged.gradeScaleValueId ?? null,
            gradeCode: data?.gradeCode ?? merged.gradeCode ?? null,
            internalStatus: data?.internalStatus ?? merged.internalStatus ?? null,
            passed: data?.passed !== undefined ? data.passed : (merged.passed ?? null),
            condicion: merged.condicion,
            saveState: 'idle',
          });
          return next;
        });
      })
      .catch(() => {
        setSubjectFinalGradeCells((prev) => {
          const cell = prev.get(cellKey);
          if (!cell) return prev;
          const next = new Map(prev);
          next.set(cellKey, { ...cell, saveState: 'error' });
          return next;
        });
      });
  }, [courseCycleId, subjectId]);

  // ── saveSubjectGrades: bounded-parallel save for dirty period grade cells ─────

  const saveSubjectGrades = useCallback(async () => {
    const snapshot = [...subjectPeriodGradeCellsRef.current.entries()].filter(
      ([, c]) => c.saveState === 'dirty' || c.saveState === 'error',
    );
    if (snapshot.length === 0) return;

    setIsSavingSubjectGrades(true);

    setSubjectPeriodGradeCells((prev) => {
      const next = new Map(prev);
      for (const [key] of snapshot) {
        const c = next.get(key);
        if (c) next.set(key, { ...c, saveState: 'saving' });
      }
      return next;
    });

    for (let i = 0; i < snapshot.length; i += 5) {
      const batch = snapshot.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(([key, cell]) =>
          apiClient
            .put('/grading/subject-grades', {
              items: [{
                courseCycleId,
                subjectId,
                studentId: cell.studentId,
                periodOrdinal: cell.periodOrdinal,
                gradeScaleValueId: cell.gradeScaleValueId,
                pa: cell.pa,
                ppi: cell.ppi,
                pp: cell.pp,
              }],
            })
            .then((res) => ({ key, success: true, data: res.data?.data }))
            .catch(() => ({ key, success: false, data: null as null })),
        ),
      );

      setSubjectPeriodGradeCells((prev) => {
        const next = new Map(prev);
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { key, success } = result.value;
            const current = next.get(key);
            if (current) {
              next.set(key, { ...current, saveState: success ? 'idle' : 'error' });
            }
          }
        }
        return next;
      });
    }

    setIsSavingSubjectGrades(false);
  }, [courseCycleId, subjectId]);

  // ── saveSubjectFinalGrades: bounded-parallel save for dirty final grade cells ──

  const saveSubjectFinalGrades = useCallback(async () => {
    const snapshot = [...subjectFinalGradeCellsRef.current.entries()].filter(
      ([, c]) => c.saveState === 'dirty' || c.saveState === 'error',
    );
    if (snapshot.length === 0) return;

    setIsSavingSubjectGrades(true);

    setSubjectFinalGradeCells((prev) => {
      const next = new Map(prev);
      for (const [key] of snapshot) {
        const c = next.get(key);
        if (c) next.set(key, { ...c, saveState: 'saving' });
      }
      return next;
    });

    for (let i = 0; i < snapshot.length; i += 5) {
      const batch = snapshot.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(([key, cell]) =>
          apiClient
            .put('/grading/subject-final-grades', {
              items: [{
                courseCycleId,
                subjectId,
                studentId: cell.studentId,
                type: cell.type,
                // null is rejected by the DTO — use undefined to omit
                gradeScaleValueId: cell.gradeScaleValueId ?? undefined,
                passed: cell.passed ?? undefined,
                // condicion: only included when set
                ...(cell.condicion !== undefined ? { condicion: cell.condicion } : {}),
              }],
            })
            .then((res) => ({ key, success: true, data: res.data?.data }))
            .catch(() => ({ key, success: false, data: null as null })),
        ),
      );

      setSubjectFinalGradeCells((prev) => {
        const next = new Map(prev);
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { key, success } = result.value;
            const current = next.get(key);
            if (current) {
              next.set(key, { ...current, saveState: success ? 'idle' : 'error' });
            }
          }
        }
        return next;
      });
    }

    setIsSavingSubjectGrades(false);
  }, [courseCycleId, subjectId]);

  return {
    loading,
    error,
    students,
    competencies,
    periodItems,
    scaleValues,
    activePeriodItemId,
    cells,
    switchPeriod,
    updateCell,
    updateImprimible,
    saveAll,
    isSavingAll,
    // Subject-grade channels
    subjectGradePeriods,
    subjectPeriodGradeCells,
    subjectFinalGradeCells,
    updateSubjectPeriodGrade,
    updateSubjectFinalGrade,
    saveSubjectGrades,
    saveSubjectFinalGrades,
    isSavingSubjectGrades,
  };
}
