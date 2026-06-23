/**
 * AsistenciaMensualPage — Monthly Attendance Planilla (SDD-4, PR-3).
 *
 * Route: /asistencia-mensual
 * Module: ATTENDANCE (READ + CREATE)
 *
 * Two modes:
 *   General  — students × days grid for a CourseCycle+month (preceptor/admin)
 *   Por Materia — students × days grid for a MateriaXCursoXCiclo+month (teacher/admin)
 *     + optional grupo filter dropdown (ADR-2)
 *
 * Generate button: POST /course-cycles/:ccId/asistencia-mensual/generate (admin-only)
 *   Materializes the register for the selected month; idempotent.
 *
 * Day cells: <select> with AttendanceType codes → PATCH /dia on change.
 *
 * API contracts:
 *   GET  /course-cycles                                               → course cycle list
 *   GET  /attendance-types                                            → code catalog
 *   POST /course-cycles/:ccId/asistencia-mensual/generate            → { generalCreated, ... }
 *   GET  /course-cycles/:ccId/asistencia-mensual?year=&month=        → general rows
 *   PATCH /course-cycles/:ccId/asistencia-mensual/dia                → updated row
 *   GET  /course-cycles/:ccId/materias                               → materia list
 *   GET  /grupos?materiaId=:materiaId                                 → grupos for materia
 *   GET  /materias-curso-ciclo/:id/asistencia-mensual?year=&month=[&grupoId=]
 *   PATCH /materias-curso-ciclo/:id/asistencia-mensual/dia           → updated row
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
// Subpath puntual (no el barrel): calendar-utils es TS puro zero-deps y bundleable.
// El barrel de @educandow/domain no es bundleable por rollup (ciclos), y la convencion
// del proyecto es no importar runtime values del barrel en el web (ver constants/levels.ts).
import { daysInMonth } from '@educandow/domain/asistencia/utils/calendar-utils';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { AlertModal } from '../../components/ui/alert-modal';

// ── Local types ───────────────────────────────────────────────────────────────

interface CourseCycle {
  uuid: string;
  name?: string;
  courseName?: string;
  level?: number;
}

interface MateriaItem {
  id: string;
  subjectName: string;
  courseCycleId: string;
}

interface GrupoItem {
  id: string;
  name: string | null;
  materiaId: string;
}

interface AttendanceTypeItem {
  id: string;
  code: string;
  name: string;
  active: boolean;
  assignable: boolean;
}

interface AsistenciaGeneralRow {
  id: string;
  courseCycleId: string;
  studentId: string;
  studentName: string;
  year: number;
  month: number;
  days: Record<string, string>;
}

interface AsistenciaMateriaRow {
  id: string;
  materiaXCursoXCicloId: string;
  studentId: string;
  studentName: string;
  year: number;
  month: number;
  days: Record<string, string>;
}

type AnyRow = AsistenciaGeneralRow | AsistenciaMateriaRow;

interface GenerationResult {
  generalCreated: number;
  generalSkipped: number;
  materiaCreated: number;
  materiaSkipped: number;
}

type PlanillaMode = 'general' | 'materia';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ── Styles ────────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs, 11px)',
  fontWeight: 600,
  color: 'var(--color-text-muted, #6b7280)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.25rem',
  display: 'block',
};

const selectStyle: React.CSSProperties = {
  padding: '0.35rem 0.5rem',
  borderRadius: 'var(--radius-sm, 4px)',
  border: '1px solid var(--color-border, #e2e8f0)',
  background: 'var(--color-surface, #fff)',
  fontSize: 'var(--text-sm, 13px)',
  minWidth: 160,
};

const cellSelectStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--color-border, #e2e8f0)',
  borderRadius: 'var(--radius-sm, 4px)',
  padding: '0.15rem 0.25rem',
  fontSize: 'var(--text-xs, 11px)',
  background: 'var(--color-surface, #fff)',
  cursor: 'pointer',
};

const cellLockedStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  border: '1px solid var(--color-border, #e2e8f0)',
  borderRadius: 'var(--radius-sm, 4px)',
  padding: '0.15rem 0.25rem',
  fontSize: 'var(--text-xs, 11px)',
  background: 'var(--color-surface-secondary, #f1f5f9)',
  color: 'var(--color-text-muted, #6b7280)',
  cursor: 'not-allowed',
  textAlign: 'center' as const,
  userSelect: 'none' as const,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AsistenciaMensualPage() {
  const today = new Date();
  const [mode, setMode] = useState<PlanillaMode>('general');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-based

  // REQ-A3: read ccId from URL search params
  const [searchParams] = useSearchParams();
  const ccIdParam = searchParams.get('ccId');

  // One-shot guard: apply ccIdParam pre-selection only once per mount
  const ccParamApplied = useRef(false);

  // Selectors
  const [courseCycles, setCourseCycles] = useState<CourseCycle[]>([]);
  const [selectedCCId, setSelectedCCId] = useState<string>('');
  const [materias, setMaterias] = useState<MateriaItem[]>([]);
  const [selectedMateriaId, setSelectedMateriaId] = useState<string>('');
  const [grupos, setGrupos] = useState<GrupoItem[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');

  // Catalog
  const [attendanceTypes, setAttendanceTypes] = useState<AttendanceTypeItem[]>([]);

  // Grid
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [noCourseModal, setNoCourseModal] = useState(false);

  // ── Initial data ─────────────────────────────────────────────────────────

  useEffect(() => {
    // Load course cycles + attendance types on mount
    Promise.all([
      apiClient.get<{ data: CourseCycle[] }>('/course-cycles'),
      apiClient.get<{ data: AttendanceTypeItem[] }>('/attendance-types'),
    ])
      .then(([ccRes, atRes]) => {
        const ccs = ccRes.data?.data ?? [];
        setCourseCycles(ccs);
        // REQ-A4: only auto-select first CC when no ccIdParam is present (no regression)
        if (ccs.length > 0 && !selectedCCId && !ccIdParam) {
          setSelectedCCId(ccs[0].uuid);
        }
        setAttendanceTypes(atRes.data?.data ?? []);
      })
      .catch(() => {
        setToast({ message: 'Error al cargar datos iniciales', type: 'error' });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── REQ-A3: pre-select CC from URL param once the list resolves ───────────

  useEffect(() => {
    if (!ccIdParam || courseCycles.length === 0) return;
    if (ccParamApplied.current) return;
    ccParamApplied.current = true;
    const match = courseCycles.find((cc) => cc.uuid === ccIdParam);
    if (match) {
      setSelectedCCId(ccIdParam);
      setMode('general');
    }
    // A3-3: ccId not in list → silent fallback (no error, no selection)
  }, [courseCycles, ccIdParam]);

  // ── Load general rows ─────────────────────────────────────────────────────

  const loadGeneralRows = useCallback(async () => {
    if (!selectedCCId || mode !== 'general') return;
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: AsistenciaGeneralRow[] }>(
        `/course-cycles/${selectedCCId}/asistencia-mensual?year=${year}&month=${month}`,
      );
      setRows(res.data?.data ?? []);
    } catch {
      setToast({ message: 'Error al cargar la asistencia', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedCCId, year, month, mode]);

  useEffect(() => {
    if (mode === 'general' && selectedCCId) {
      loadGeneralRows();
    }
  }, [mode, selectedCCId, year, month, loadGeneralRows]);

  // ── Load materias when CC changes (for materia mode) ─────────────────────

  useEffect(() => {
    if (mode !== 'materia' || !selectedCCId) return;
    apiClient.get<{ data: MateriaItem[] }>(`/course-cycles/${selectedCCId}/materias`)
      .then((res) => {
        const ms = res.data?.data ?? [];
        setMaterias(ms);
        if (ms.length > 0) {
          setSelectedMateriaId(ms[0].id);
        } else {
          setSelectedMateriaId('');
          // 200 con lista vacía → tampoco tiene materias/curso para mostrar
          setNoCourseModal(true);
        }
        setSelectedGrupoId('');
        setGrupos([]);
      })
      .catch((err) => {
        setMaterias([]);
        setSelectedMateriaId('');
        // 403 → el usuario no tiene un curso asignado para ver sus materias
        if (err?.response?.status === 403) {
          setNoCourseModal(true);
        }
      });
  }, [mode, selectedCCId]);

  // ── Load grupos when materia changes ──────────────────────────────────────

  useEffect(() => {
    if (mode !== 'materia' || !selectedMateriaId) {
      setGrupos([]);
      setSelectedGrupoId('');
      return;
    }
    apiClient.get<{ data: GrupoItem[] }>(`/grupos?materiaId=${selectedMateriaId}`)
      .then((res) => {
        const gs = res.data?.data ?? [];
        setGrupos(gs);
        setSelectedGrupoId('');
      })
      .catch(() => {
        setGrupos([]);
        setSelectedGrupoId('');
      });
  }, [mode, selectedMateriaId]);

  // ── Load subject rows ─────────────────────────────────────────────────────

  const loadSubjectRows = useCallback(async () => {
    if (!selectedMateriaId || mode !== 'materia') return;
    setLoading(true);
    try {
      const grupoParam = selectedGrupoId ? `&grupoId=${selectedGrupoId}` : '';
      const res = await apiClient.get<{ data: AsistenciaMateriaRow[] }>(
        `/materias-curso-ciclo/${selectedMateriaId}/asistencia-mensual?year=${year}&month=${month}${grupoParam}`,
      );
      setRows(res.data?.data ?? []);
    } catch {
      setToast({ message: 'Error al cargar la asistencia por materia', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedMateriaId, year, month, selectedGrupoId, mode]);

  useEffect(() => {
    if (mode === 'materia' && selectedMateriaId) {
      loadSubjectRows();
    }
  }, [mode, selectedMateriaId, year, month, selectedGrupoId, loadSubjectRows]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!selectedCCId) return;
    setGenerateLoading(true);
    try {
      const res = await apiClient.post<{ data: GenerationResult }>(
        `/course-cycles/${selectedCCId}/asistencia-mensual/generate`,
        { year, month },
      );
      const counts = res.data?.data;
      const msg = counts
        ? `Generado: ${counts.generalCreated} general + ${counts.materiaCreated} materia (omitidos: ${counts.generalSkipped + counts.materiaSkipped})`
        : 'Asistencia generada';
      setToast({ message: msg, type: 'success' });
      if (mode === 'general') {
        await loadGeneralRows();
      } else {
        await loadSubjectRows();
      }
    } catch {
      setToast({ message: 'Error al generar la asistencia', type: 'error' });
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleRecordGeneralDay = async (studentId: string, day: number, statusCode: string) => {
    if (!selectedCCId) return;
    try {
      const res = await apiClient.patch<{ data: AsistenciaGeneralRow }>(
        `/course-cycles/${selectedCCId}/asistencia-mensual/dia`,
        { studentId, year, month, day, statusCode },
      );
      const updated = res.data?.data;
      if (updated) {
        setRows((prev) =>
          prev.map((r) => (r.studentId === studentId ? { ...r, days: updated.days } : r)),
        );
      }
    } catch {
      setToast({ message: 'Error al registrar la asistencia', type: 'error' });
    }
  };

  const handleRecordSubjectDay = async (studentId: string, day: number, statusCode: string) => {
    if (!selectedMateriaId) return;
    try {
      const res = await apiClient.patch<{ data: AsistenciaMateriaRow }>(
        `/materias-curso-ciclo/${selectedMateriaId}/asistencia-mensual/dia`,
        { studentId, year, month, day, statusCode },
      );
      const updated = res.data?.data;
      if (updated) {
        setRows((prev) =>
          prev.map((r) => (r.studentId === studentId ? { ...r, days: updated.days } : r)),
        );
      }
    } catch {
      setToast({ message: 'Error al registrar la asistencia por materia', type: 'error' });
    }
  };

  // ── Mode switch ───────────────────────────────────────────────────────────

  const switchMode = (next: PlanillaMode) => {
    if (next === mode) return;
    setMode(next);
    setRows([]);
    setSelectedMateriaId('');
    setSelectedGrupoId('');
    setGrupos([]);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const numDays = daysInMonth(year, month);
  const dayColumns = Array.from({ length: 31 }, (_, i) => i + 1);
  const codes = attendanceTypes.filter((t) => t.active && t.assignable).map((t) => t.code);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="asistencia-mensual-page"
      style={{ padding: 'var(--space-md, 1rem)', maxWidth: '100%', overflowX: 'auto' }}
    >
      {/* Page header */}
      <h2 style={{ marginBottom: '1rem', fontWeight: 700, fontSize: 'var(--text-lg, 18px)' }}>
        Asistencia Mensual
      </h2>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <Button
          variant={mode === 'general' ? 'primary' : 'ghost'}
          size="sm"
          data-testid="tab-general"
          onClick={() => switchMode('general')}
        >
          General (Curso)
        </Button>
        <Button
          variant={mode === 'materia' ? 'primary' : 'ghost'}
          size="sm"
          data-testid="tab-materia"
          onClick={() => switchMode('materia')}
        >
          Por Materia
        </Button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'flex-end' }}>
        {/* CourseCycle selector */}
        <div>
          <label style={labelStyle}>Curso / Ciclo</label>
          <select
            data-testid="cc-selector"
            style={selectStyle}
            value={selectedCCId}
            onChange={(e) => setSelectedCCId(e.target.value)}
          >
            {courseCycles.map((cc) => (
              <option key={cc.uuid} value={cc.uuid}>
                {cc.name ?? cc.courseName ?? cc.uuid}
              </option>
            ))}
          </select>
        </div>

        {/* Materia selector — only in materia mode */}
        {mode === 'materia' && (
          <div>
            <label style={labelStyle}>Materia</label>
            <select
              data-testid="materia-selector"
              style={selectStyle}
              value={selectedMateriaId}
              onChange={(e) => {
                setSelectedMateriaId(e.target.value);
                setSelectedGrupoId('');
              }}
            >
              {materias.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.subjectName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Grupo filter — only in materia mode when materia has grupos */}
        {mode === 'materia' && grupos.length > 0 && (
          <div>
            <label style={labelStyle}>Grupo</label>
            <select
              data-testid="grupo-selector"
              style={selectStyle}
              value={selectedGrupoId}
              onChange={(e) => setSelectedGrupoId(e.target.value)}
            >
              <option value="">Todos los alumnos</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name ?? g.id}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Month selector */}
        <div>
          <label style={labelStyle}>Mes</label>
          <select
            data-testid="month-selector"
            style={selectStyle}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((label, i) => (
              <option key={i + 1} value={i + 1}>{label}</option>
            ))}
          </select>
        </div>

        {/* Year input */}
        <div>
          <label style={labelStyle}>Año</label>
          <input
            data-testid="year-input"
            type="number"
            style={{ ...selectStyle, width: 80 }}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2020}
            max={2100}
          />
        </div>

        {/* Generate button (admin) */}
        <Button
          variant="action"
          size="sm"
          data-testid="btn-generar"
          onClick={handleGenerate}
          disabled={generateLoading || !selectedCCId}
        >
          {generateLoading ? 'Generando…' : 'Generar asistencia del mes'}
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <p style={{ color: 'var(--color-text-muted, #6b7280)', fontSize: 'var(--text-sm, 13px)' }}>
          Cargando planilla…
        </p>
      ) : (
        <div data-testid="grid-container" style={{ overflowX: 'auto' }}>
          {rows.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted, #6b7280)', fontSize: 'var(--text-sm, 13px)' }}>
              No hay datos para este mes. Usá el botón "Generar asistencia del mes" para crear las filas.
            </p>
          ) : (
            <table
              style={{
                borderCollapse: 'collapse',
                fontSize: 'var(--text-xs, 11px)',
                minWidth: '100%',
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '0.25rem 0.5rem',
                      borderBottom: '2px solid var(--color-border, #e2e8f0)',
                      minWidth: 120,
                      background: 'var(--color-surface-secondary)',
                    }}
                  >
                    Alumno
                  </th>
                  {dayColumns.map((d) => (
                    <th
                      key={d}
                      style={{
                        padding: '0.25rem 0.15rem',
                        borderBottom: '2px solid var(--color-border, #e2e8f0)',
                        minWidth: 36,
                        textAlign: 'center',
                        background: 'var(--color-surface-secondary)',
                      }}
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.studentId} data-testid={`student-row-${row.studentId}`}>
                    <td
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderBottom: '1px solid var(--color-border, #e2e8f0)',
                        fontWeight: 500,
                        fontSize: 'var(--text-xs, 11px)',
                        maxWidth: 160,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.studentName}
                    </td>
                    {dayColumns.map((d) => {
                      const code = row.days[String(d)];
                      const at = code
                        ? attendanceTypes.find((a) => a.code === code)
                        : undefined;
                      const isLockedByCode = at?.assignable === false;
                      const isNonExistent = d > numDays;
                      const locked = isLockedByCode || isNonExistent;

                      return (
                        <td
                          key={d}
                          style={{
                            padding: '0.1rem',
                            borderBottom: '1px solid var(--color-border, #e2e8f0)',
                            borderLeft: '1px solid var(--color-border, #e2e8f0)',
                            textAlign: 'center',
                          }}
                        >
                          {locked ? (
                            <span
                              data-testid={`cell-locked-${row.studentId}-${d}`}
                              style={cellLockedStyle}
                            >
                              {code ?? '—'}
                            </span>
                          ) : (
                            <select
                              data-testid={`cell-${row.studentId}-${d}`}
                              style={cellSelectStyle}
                              value={code ?? ''}
                              onChange={(e) => {
                                const selected = e.target.value;
                                if (!selected) return;
                                if (mode === 'general') {
                                  void handleRecordGeneralDay(row.studentId, d, selected);
                                } else {
                                  void handleRecordSubjectDay(row.studentId, d, selected);
                                }
                              }}
                            >
                              <option value="">—</option>
                              {codes.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          data-testid="asistencia-toast"
          style={{
            marginTop: '1rem',
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-sm, 4px)',
            background: toast.type === 'success' ? '#16a34a' : '#dc2626',
            color: '#fff',
            fontSize: 'var(--text-sm, 13px)',
            cursor: 'pointer',
            maxWidth: 480,
          }}
          onClick={() => setToast(null)}
        >
          {toast.message}
        </div>
      )}

      {/* Popup: usuario sin curso asignado (403 al listar materias) */}
      <AlertModal
        open={noCourseModal}
        title="Sin curso asignado"
        message="No tenés asignado ningún curso, por lo que no podés ver las materias. Contactá al administrador de tu institución."
        onClose={() => setNoCourseModal(false)}
      />
    </div>
  );
}
