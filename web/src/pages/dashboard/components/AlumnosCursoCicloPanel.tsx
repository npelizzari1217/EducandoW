/**
 * AlumnosCursoCicloPanel — SDD-1 T-21 + SDD-2 T40
 *
 * Inline panel that lists students assigned to a CourseCycle, lets the user
 * add students one-by-one, remove them, toggle their printable flag, and
 * trigger boletín batch download.
 *
 * API contract (PR-1 + PR-5):
 *   GET    /course-cycles/:ccId/alumnos              → enriched list { id, studentId, studentName, printable }
 *   POST   /course-cycles/:ccId/alumnos              body { studentId } → 201
 *   DELETE /course-cycles/:ccId/alumnos/:id          (bridge-row id)   → 204
 *   PATCH  /course-cycles/:ccId/alumnos/:id/printable body { value }   → 204
 *   PATCH  /course-cycles/:ccId/alumnos/printable    body { value }    → 204 (bulk)
 *   GET    /students                                  → universe of students
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../components/ui/button';
import apiClient from '../../../api/client';
import { downloadBoletinBatch } from '../../../hooks/useBoletin';

// ── Local types ───────────────────────────────────────────────────────────────

interface AlumnoCursoCicloItem {
  id: string;        // bridge-row id — used for DELETE and PATCH printable
  studentId: string;
  studentName: string;
  printable: boolean;
}

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
}

export interface AlumnosCursoCicloPanelProps {
  ccId: string;
  onClose: () => void;
}

// ── Derived printable state ───────────────────────────────────────────────────

function derivePrintableState(rows: AlumnoCursoCicloItem[]): 'Todos' | 'Algunos' | 'Ninguno' {
  if (rows.length === 0) return 'Ninguno';
  const printableCount = rows.filter((r) => r.printable).length;
  if (printableCount === rows.length) return 'Todos';
  if (printableCount === 0) return 'Ninguno';
  return 'Algunos';
}

// ── Shared style tokens ───────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 500,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.25rem 0.5rem',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface-2, #f8fafc)',
  marginBottom: '0.25rem',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AlumnosCursoCicloPanel({ ccId, onClose }: AlumnosCursoCicloPanelProps) {
  const [current, setCurrent] = useState<AlumnoCursoCicloItem[]>([]);
  const [allStudents, setAllStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [cascadingIds, setCascadingIds] = useState<Set<string>>(new Set());
  const [cascadeToast, setCascadeToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [currentRes, studentsRes] = await Promise.all([
        apiClient.get<{ data: AlumnoCursoCicloItem[] }>(`/course-cycles/${ccId}/alumnos`),
        apiClient.get<{ data: StudentItem[] }>('/students'),
      ]);
      setCurrent(currentRes.data?.data ?? []);
      setAllStudents(studentsRes.data?.data ?? []);
    } catch {
      setCurrent([]);
      setAllStudents([]);
    } finally {
      setLoading(false);
    }
  }, [ccId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleAdd = async (studentId: string) => {
    try {
      await apiClient.post(`/course-cycles/${ccId}/alumnos`, { studentId });
      setToast({ message: 'Alumno agregado al ciclo', type: 'success' });
      await load();
    } catch {
      setToast({ message: 'Error al agregar el alumno', type: 'error' });
    }
  };

  const handleRemove = async (rowId: string) => {
    try {
      await apiClient.delete(`/course-cycles/${ccId}/alumnos/${rowId}`);
      setToast({ message: 'Alumno quitado del ciclo', type: 'success' });
      await load();
    } catch {
      setToast({ message: 'Error al quitar el alumno', type: 'error' });
    }
  };

  const handleTogglePrintable = async (rowId: string, currentValue: boolean) => {
    try {
      await apiClient.patch(`/course-cycles/${ccId}/alumnos/${rowId}/printable`, { value: !currentValue });
      // Optimistic local update
      setCurrent((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, printable: !currentValue } : r)),
      );
    } catch {
      setToast({ message: 'Error al actualizar impresión', type: 'error' });
    }
  };

  const handleBulkPrintable = async (value: boolean) => {
    try {
      await apiClient.patch(`/course-cycles/${ccId}/alumnos/printable`, { value });
      setCurrent((prev) => prev.map((r) => ({ ...r, printable: value })));
    } catch {
      setToast({ message: 'Error al actualizar impresión en masa', type: 'error' });
    }
  };

  const handleImprimir = async () => {
    try {
      await downloadBoletinBatch(ccId);
    } catch {
      setToast({ message: 'Error al descargar boletines', type: 'error' });
    }
  };

  /**
   * handleCascade — POST /course-cycles/:ccId/alumnos/:rowId/cascade
   * Materializes all plan materias + active competencies for a single student.
   * Button is disabled while in flight (no double-submit). Returns counts in toast.
   * SDD-3 PR-3, R-21.
   */
  const handleCascade = async (rowId: string) => {
    setCascadingIds((prev) => new Set(prev).add(rowId));
    setCascadeToast(null);
    try {
      const res = await apiClient.post<{ data: {
        materiasCreated: number; materiasSkipped: number;
        competenciasCreated: number; competenciasSkipped: number;
      } }>(`/course-cycles/${ccId}/alumnos/${rowId}/cascade`);
      const counts = res.data?.data;
      if (counts) {
        setCascadeToast({
          message: `${counts.materiasCreated} materia(s) y ${counts.competenciasCreated} competencia(s) asignadas`,
          type: 'success',
        });
      }
    } catch {
      setCascadeToast({ message: 'Error al asignar materias y competencias', type: 'error' });
    } finally {
      setCascadingIds((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const assignedStudentIds = new Set(current.map((c) => c.studentId));
  const unassigned = allStudents.filter((s) => !assignedStudentIds.has(s.id));
  const printableState = derivePrintableState(current);
  const printableCount = current.filter((r) => r.printable).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="alumnos-curso-panel"
      style={{
        margin: '0.5rem 0',
        padding: 'var(--space-sm)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--color-surface)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>
          Alumnos del Ciclo
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          data-testid="btn-cerrar"
        >
          Cerrar
        </Button>
      </div>

      {/* Loading */}
      {loading && <p style={{ ...labelStyle }}>Cargando...</p>}

      {!loading && (
        <>
          {/* Currently assigned */}
          <div style={{ marginBottom: 'var(--space-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ ...labelStyle }}>
                Asignados ({current.length})
              </span>
              {/* Printable aggregate state label */}
              {current.length > 0 && (
                <span
                  data-testid="printable-state-label"
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: printableState === 'Todos'
                      ? 'var(--color-success, #16a34a)'
                      : printableState === 'Ninguno'
                        ? 'var(--color-danger, #dc2626)'
                        : 'var(--color-warning, #d97706)',
                  }}
                >
                  {printableState}
                </span>
              )}
            </div>

            {current.length === 0 && (
              <p
                style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}
              >
                Sin alumnos asignados a este ciclo.
              </p>
            )}

            {current.map((alumno) => (
              <div key={alumno.id} style={rowStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Per-row printable toggle */}
                  <input
                    type="checkbox"
                    data-testid={`printable-${alumno.id}`}
                    checked={alumno.printable}
                    onChange={() => handleTogglePrintable(alumno.id, alumno.printable)}
                    title={alumno.printable ? 'Quitar del boletín' : 'Incluir en boletín'}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 'var(--text-sm)' }}>{alumno.studentName}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {/* Cascade: assign materias + competencias for this student */}
                  <Button
                    variant="action"
                    size="sm"
                    data-testid={`btn-cascade-${alumno.id}`}
                    onClick={() => handleCascade(alumno.id)}
                    disabled={cascadingIds.has(alumno.id)}
                    title="Asignar materias y competencias"
                  >
                    Asignar materias y competencias
                  </Button>
                  <Button
                    variant="danger-soft"
                    size="sm"
                    data-testid={`btn-remove-alumno-${alumno.id}`}
                    onClick={() => handleRemove(alumno.id)}
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Printable controls */}
          {current.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-sm)', flexWrap: 'wrap' }}>
              <Button
                variant="action"
                size="sm"
                data-testid="btn-todos"
                onClick={() => handleBulkPrintable(true)}
              >
                Todos
              </Button>
              <Button
                variant="action"
                size="sm"
                data-testid="btn-ninguno"
                onClick={() => handleBulkPrintable(false)}
              >
                Ninguno
              </Button>
              <Button
                variant="success-soft"
                size="sm"
                data-testid="btn-imprimir"
                onClick={handleImprimir}
                disabled={printableCount === 0}
                title={printableCount === 0 ? 'Sin alumnos para imprimir' : `Imprimir ${printableCount} boletín(es)`}
              >
                🖨 Imprimir ({printableCount})
              </Button>
            </div>
          )}

          {/* Available to add */}
          {unassigned.length > 0 && (
            <div>
              <span style={{ ...labelStyle }}>Disponibles para agregar</span>
              {unassigned.map((student) => (
                <div key={student.id} style={rowStyle}>
                  <span style={{ fontSize: 'var(--text-sm)' }}>
                    {student.fullName ?? `${student.firstName} ${student.lastName}`}
                  </span>
                  <Button
                    variant="action"
                    size="sm"
                    data-testid={`btn-add-alumno-${student.id}`}
                    onClick={() => handleAdd(student.id)}
                  >
                    +
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            marginTop: 'var(--space-sm)',
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            background: toast.type === 'success' ? '#16a34a' : '#dc2626',
            color: '#fff',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
          }}
          onClick={() => setToast(null)}
        >
          {toast.message}
        </div>
      )}

      {/* Cascade toast — shows counts returned by POST /cascade */}
      {cascadeToast && (
        <div
          data-testid="cascade-toast"
          style={{
            marginTop: 'var(--space-sm)',
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            background: cascadeToast.type === 'success' ? '#2563eb' : '#dc2626',
            color: '#fff',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
          }}
          onClick={() => setCascadeToast(null)}
        >
          {cascadeToast.message}
        </div>
      )}
    </div>
  );
}
