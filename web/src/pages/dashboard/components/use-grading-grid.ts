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

interface RawPeriodValuation {
  periodItemId: string;
  gradeScaleValueId: string | null;
  gradeCode: string | null;
  internalStatus: string | null;
  modificable: boolean;
}

interface RawValuation {
  valuationId: string;
  studentId: string;
  competencyId: string;
  periodValuations: RawPeriodValuation[];
}

export interface GradingGridOptions {
  courseCycleId: string;
  studyPlanSubjectId: string;
  level: number;
  modality: number | null;
}

export interface UseGradingGridReturn {
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
  saveAll: () => Promise<void>;
  isSavingAll: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useGradingGrid({
  courseCycleId,
  studyPlanSubjectId,
  level,
  modality,
}: GradingGridOptions): UseGradingGridReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [competencies, setCompetencies] = useState<SubjectCompetency[]>([]);
  const [periodItems, setPeriodItems] = useState<PeriodItem[]>([]);
  const [scaleValues, setScaleValues] = useState<ScaleValue[]>([]);
  const [activePeriodItemId, setActivePeriodItemId] = useState<string | null>(null);
  const [cells, setCells] = useState<Map<string, CellState>>(new Map());
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Keep ref in sync with cells state for async reads in saveAll
  const cellsRef = useRef<Map<string, CellState>>(new Map());
  cellsRef.current = cells;

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

    Promise.allSettled([
      apiClient.get(`/course-cycles/${courseCycleId}/students`),
      apiClient.get('/subject-competencies', { params: { studyPlanSubjectId } }),
      apiClient.get('/grading/period-templates', { params: templateParams }),
      apiClient.get('/grading/scales', { params: templateParams }),
      apiClient.get('/competency-valuations', { params: { courseCycleId, studyPlanSubjectId } }),
    ]).then(([studentsRes, compRes, periodsRes, scalesRes, valuationsRes]) => {
      const studentsData: EnrolledStudent[] =
        studentsRes.status === 'fulfilled' ? (studentsRes.value.data?.data ?? []) : [];

      const compData: SubjectCompetency[] =
        compRes.status === 'fulfilled' ? (compRes.value.data?.data ?? []) : [];

      // Flatten period items from all matching templates, sort by sort_order
      const templates = periodsRes.status === 'fulfilled' ? (periodsRes.value.data?.data ?? []) : [];
      const allItems: PeriodItem[] = (templates as Array<{ items?: PeriodItem[] }>)
        .flatMap((t) => t.items ?? [])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      // Flatten scale values from all matching scales, sort by sort_order
      const scales = scalesRes.status === 'fulfilled' ? (scalesRes.value.data?.data ?? []) : [];
      const allValues: ScaleValue[] = (scales as Array<{ values?: ScaleValue[] }>)
        .flatMap((s) => s.values ?? [])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const valuations: RawValuation[] =
        valuationsRes.status === 'fulfilled' ? (valuationsRes.value.data?.data ?? []) : [];

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
            saveState: 'idle',
          });
        }
      }

      setStudents(studentsData);
      setCompetencies(compData);
      setPeriodItems(allItems);
      setScaleValues(allValues);
      setActivePeriodItemId(allItems[0]?.id ?? null);
      setCells(cellsMap);
      setLoading(false);
    }).catch(() => {
      setError('Error al cargar los datos de la grilla');
      setLoading(false);
    });
  }, [courseCycleId, studyPlanSubjectId, level, modality]);

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
    saveAll,
    isSavingAll,
  };
}
