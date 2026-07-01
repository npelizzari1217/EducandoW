import { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import { extractErrorMessage } from './use-api';

export type AttendanceMonthStatusValue = 'OPEN' | 'CLOSED' | null;

/**
 * useAttendanceMonthStatus — GET/PATCH /course-cycles/:ccId/asistencia-mensual/estado
 * (Capacidad B, PR-3b backend). Used by asistencia-mensual.tsx to reflect and toggle
 * the open/closed state of a CourseCycle+year+month, driving the read-only grid gate.
 */
export function useAttendanceMonthStatus(ccId: string | null, year: number, month: number) {
  const [status, setStatusValue] = useState<AttendanceMonthStatusValue>(null);
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const [closedBy, setClosedBy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!ccId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(
        `/course-cycles/${ccId}/asistencia-mensual/estado?year=${year}&month=${month}`,
      );
      const data = res.data?.data;
      setStatusValue(data?.status ?? 'OPEN');
      setClosedAt(data?.closedAt ?? null);
      setClosedBy(data?.closedBy ?? null);
    } catch {
      setError('Error al cargar el estado del mes');
    } finally {
      setLoading(false);
    }
  }, [ccId, year, month]);

  useEffect(() => {
    reload();
  }, [reload]);

  const setStatus = useCallback(
    async (next: 'OPEN' | 'CLOSED'): Promise<boolean> => {
      if (!ccId) return false;
      setSaving(true);
      setError('');
      try {
        const res = await apiClient.patch(`/course-cycles/${ccId}/asistencia-mensual/estado`, {
          year,
          month,
          status: next,
        });
        const data = res.data?.data;
        setStatusValue(data?.status ?? next);
        setClosedAt(data?.closedAt ?? null);
        setClosedBy(data?.closedBy ?? null);
        return true;
      } catch (e: unknown) {
        setError(extractErrorMessage(e));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [ccId, year, month],
  );

  return { status, closedAt, closedBy, loading, saving, error, setStatus, reload };
}
