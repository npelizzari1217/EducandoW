import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { extractErrorMessage } from './use-api';
import type { GradingPhaseValue } from '../pages/dashboard/components/grading-phase-utils';

/**
 * useGradingPhase — GET/PATCH /course-cycles/:uuid/grading-phase (Capacidad A, PR-1 backend).
 * Used by course-cycles.tsx to activate/change the bimester grading phase.
 */
export function useGradingPhase(uuid: string | null) {
  const [gradingPhase, setGradingPhase] = useState<GradingPhaseValue>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(`/course-cycles/${uuid}/grading-phase`);
      setGradingPhase(res.data?.data?.gradingPhase ?? null);
    } catch {
      setError('Error al cargar la fase de calificación');
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setPhase = useCallback(
    async (phase: GradingPhaseValue): Promise<boolean> => {
      if (!uuid) return false;
      setSaving(true);
      setError('');
      try {
        const res = await apiClient.patch(`/course-cycles/${uuid}/grading-phase`, { gradingPhase: phase });
        setGradingPhase(res.data?.data?.gradingPhase ?? phase);
        return true;
      } catch (e: unknown) {
        setError(extractErrorMessage(e));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [uuid],
  );

  return { gradingPhase, loading, saving, error, setPhase, reload };
}
