/**
 * AlumnosCursoCicloPanel — T-21
 *
 * Inline panel that lists students assigned to a CourseCycle, lets the user
 * add students one-by-one, and remove them.  Mirrors AlumnosPanelInline from
 * materia-grupos.tsx exactly in look & interaction.
 *
 * API contract (PR-3):
 *   GET    /course-cycles/:ccId/alumnos           → enriched list { id, studentId, studentName }
 *   POST   /course-cycles/:ccId/alumnos           body { studentId } → 201
 *   DELETE /course-cycles/:ccId/alumnos/:id       (bridge-row id)   → 204
 *   GET    /students                               → universe of students { id, firstName, lastName, fullName }
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../components/ui/button';
import apiClient from '../../../api/client';

// ── Local types ───────────────────────────────────────────────────────────────

interface AlumnoCursoCicloItem {
  id: string;        // bridge-row id — used for DELETE
  studentId: string;
  studentName: string;
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

  // ── Derived data ──────────────────────────────────────────────────────────

  const assignedStudentIds = new Set(current.map((c) => c.studentId));
  const unassigned = allStudents.filter((s) => !assignedStudentIds.has(s.id));

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
            <span style={{ ...labelStyle }}>
              Asignados ({current.length})
            </span>

            {current.length === 0 && (
              <p
                style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}
              >
                Sin alumnos asignados a este ciclo.
              </p>
            )}

            {current.map((alumno) => (
              <div key={alumno.id} style={rowStyle}>
                <span style={{ fontSize: 'var(--text-sm)' }}>{alumno.studentName}</span>
                <Button
                  variant="danger-soft"
                  size="sm"
                  data-testid={`btn-remove-alumno-${alumno.id}`}
                  onClick={() => handleRemove(alumno.id)}
                >
                  Quitar
                </Button>
              </div>
            ))}
          </div>

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
    </div>
  );
}
