/**
 * AlumnosCursoCicloPanel — SDD-1 T-21 + SDD-2 T40 + SDD-5 T-4x (pase alumno)
 *
 * Inline panel that lists students assigned to a CourseCycle, lets the user
 * add students one-by-one, remove them, toggle their printable flag, trigger
 * boletín batch download, and register / revert a student's pase (egreso).
 *
 * API contract (PR-1 + PR-5 + PR4-pase):
 *   GET    /course-cycles/:ccId/alumnos                       → enriched list
 *   POST   /course-cycles/:ccId/alumnos                       body { studentId } → 201
 *   DELETE /course-cycles/:ccId/alumnos/:id                   (bridge-row id)   → 204
 *   PATCH  /course-cycles/:ccId/alumnos/:id/printable         body { value }    → 204
 *   PATCH  /course-cycles/:ccId/alumnos/printable             body { value }    → 204 (bulk)
 *   PATCH  /course-cycles/:ccId/alumnos/:id/pase              body { fechaDePase: string | null } → 204
 *   GET    /students                                           → universe of students
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import apiClient from '../../../api/client';
import { downloadBoletinBatch } from '../../../hooks/useBoletin';
import { printConstancia, downloadConstancia } from '../../../hooks/useConstancia';
import { useCan } from '../../../hooks/use-can';

// ── Local types ───────────────────────────────────────────────────────────────

interface AlumnoCursoCicloItem {
  id: string;        // bridge-row id — used for DELETE and PATCH printable / pase
  studentId: string;
  studentName: string;
  printable: boolean;
  /** ISO date string (YYYY-MM-DD) when the student has been given a pase; null otherwise. */
  fechaDePase: string | null;
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
  /** When rendered inside a Modal, hide the panel's own header (Modal provides title + close). */
  embedded?: boolean;
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
  background: 'var(--color-surface-secondary)',
  marginBottom: '0.25rem',
};

// ── Constancia constants & helpers ────────────────────────────────────────────

const DEFAULT_CONSTANCIA_DESTINATARIO =
  'A pedido del interesado y para ser presentado ante quien corresponda';

/** Returns today's date as YYYY-MM-DD using LOCAL components (avoids UTC TZ shift). */
function todayLocalISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AlumnosCursoCicloPanel({ ccId, onClose, embedded }: AlumnosCursoCicloPanelProps) {
  const navigate = useNavigate();
  const { can } = useCan();

  const [current, setCurrent] = useState<AlumnoCursoCicloItem[]>([]);
  const [allStudents, setAllStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [cascadingIds, setCascadingIds] = useState<Set<string>>(new Set());
  const [cascadeToast, setCascadeToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Pase modal state ──────────────────────────────────────────────────────
  const [paseTarget, setPaseTarget] = useState<AlumnoCursoCicloItem | null>(null);
  const [paseFecha, setPaseFecha] = useState('');

  // ── Constancia modal state ─────────────────────────────────────────────────
  const [constanciaTarget, setConstanciaTarget] = useState<AlumnoCursoCicloItem | null>(null);
  const [constanciaDestinatario, setConstanciaDestinatario] = useState(DEFAULT_CONSTANCIA_DESTINATARIO);
  const [constanciaFecha, setConstanciaFecha] = useState(todayLocalISO);

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

  // ── Pase handlers ─────────────────────────────────────────────────────────

  const handleCancelarPase = () => {
    setPaseTarget(null);
    setPaseFecha('');
  };

  const handleConfirmarPase = async () => {
    if (!paseTarget || !paseFecha) return;
    try {
      await apiClient.patch(
        `/course-cycles/${ccId}/alumnos/${paseTarget.id}/pase`,
        { fechaDePase: paseFecha },
      );
      setToast({ message: 'Pase registrado correctamente', type: 'success' });
      setPaseTarget(null);
      setPaseFecha('');
      await load();
    } catch {
      setToast({ message: 'Error al registrar el pase', type: 'error' });
    }
  };

  // ── Constancia handlers ───────────────────────────────────────────────────

  const handleOpenConstancia = (alumno: AlumnoCursoCicloItem) => {
    setConstanciaTarget(alumno);
    setConstanciaDestinatario(DEFAULT_CONSTANCIA_DESTINATARIO);
    setConstanciaFecha(todayLocalISO());
  };

  const handleCerrarConstancia = () => {
    setConstanciaTarget(null);
  };

  const handleConstanciaImprimir = async () => {
    if (!constanciaTarget) return;
    try {
      await printConstancia(constanciaTarget.id, {
        destinatario: constanciaDestinatario,
        fechaEmision: constanciaFecha,
      });
      setConstanciaTarget(null);
    } catch {
      setToast({ message: 'Error al generar la constancia', type: 'error' });
    }
  };

  const handleConstanciaDescargar = async () => {
    if (!constanciaTarget) return;
    try {
      await downloadConstancia(constanciaTarget.id, {
        destinatario: constanciaDestinatario,
        fechaEmision: constanciaFecha,
      });
      setConstanciaTarget(null);
    } catch {
      setToast({ message: 'Error al descargar la constancia', type: 'error' });
    }
  };

  const handleRevertirPase = async (rowId: string) => {
    try {
      await apiClient.patch(
        `/course-cycles/${ccId}/alumnos/${rowId}/pase`,
        { fechaDePase: null },
      );
      setToast({ message: 'Pase revertido correctamente', type: 'success' });
      await load();
    } catch {
      setToast({ message: 'Error al revertir el pase', type: 'error' });
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const assignedStudentIds = new Set(current.map((c) => c.studentId));
  const unassigned = allStudents.filter((s) => !assignedStudentIds.has(s.id));
  const printableState = derivePrintableState(current);
  const printableCount = current.filter((r) => r.printable).length;

  // max date for the pase picker — enforces the backend's "no future date" rule at UI level
  const todayIso = new Date().toISOString().split('T')[0];

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
      {/* Header — hidden when embedded in a Modal (Modal provides title + close) */}
      {!embedded && (
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
      )}

      {/* REQ-A1 / REQ-A2: attendance shortcut — always rendered (embedded and non-embedded).
          Gated by ATTENDANCE READ. Placed outside the header block so it is visible inside
          the Modal that course-cycles.tsx opens (which always passes embedded=true). */}
      {can('ATTENDANCE', 'READ') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <Button
            variant="action"
            size="sm"
            data-testid="btn-ver-asistencia"
            onClick={() => navigate(`/asistencia-mensual?ccId=${ccId}`)}
          >
            Ver asistencia
          </Button>
        </div>
      )}

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

            {/* Column headers — only when there are assigned students */}
            {current.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', marginBottom: '0.125rem', gap: '0.5rem' }}>
                <span style={{ flex: 1 }} />
                <span
                  data-testid="col-header-pase"
                  style={{ width: '2.5rem', ...labelStyle }}
                >
                  Pase
                </span>
                <span
                  data-testid="col-header-fecha-pase"
                  style={{ width: '6.5rem', ...labelStyle }}
                >
                  Fecha de pase
                </span>
                <span style={{ width: '1rem' }} />
              </div>
            )}

            {current.map((alumno) => (
              <div key={alumno.id} style={rowStyle}>
                {/* Left: checkbox + name + pase data cells */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  {/* Per-row printable toggle */}
                  <input
                    type="checkbox"
                    data-testid={`printable-${alumno.id}`}
                    checked={alumno.printable}
                    onChange={() => handleTogglePrintable(alumno.id, alumno.printable)}
                    title={alumno.printable ? 'Quitar del boletín' : 'Incluir en boletín'}
                    style={{ cursor: 'pointer' }}
                  />
                  {/*
                   * Name — line-through + reduced opacity when the student has a pase.
                   * Style is applied ONLY to this span, not to the action buttons.
                   */}
                  <span
                    data-testid={`alumno-nombre-${alumno.id}`}
                    style={{
                      fontSize: 'var(--text-sm)',
                      flex: 1,
                      ...(alumno.fechaDePase
                        ? { textDecoration: 'line-through', opacity: 0.6 }
                        : {}),
                    }}
                  >
                    {alumno.studentName}
                  </span>
                  {/* Pase indicator — "Sí" when has pase, empty otherwise */}
                  <span
                    data-testid={`pase-indicator-${alumno.id}`}
                    style={{ width: '2.5rem', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}
                  >
                    {alumno.fechaDePase ? 'Sí' : ''}
                  </span>
                  {/*
                   * Fecha de pase — formatted as es-AR locale date or '—'.
                   * Note: toLocaleDateString('es-AR') from an ISO UTC string can shift one
                   * day in negative-offset timezones (display-only, not persisted — acceptable).
                   */}
                  <span
                    data-testid={`fecha-pase-${alumno.id}`}
                    style={{ width: '6.5rem', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}
                  >
                    {alumno.fechaDePase
                      ? new Date(alumno.fechaDePase).toLocaleDateString('es-AR')
                      : '—'}
                  </span>
                </div>

                {/* Right: action buttons */}
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {/* Pase / Revertir pase */}
                  {alumno.fechaDePase ? (
                    <Button
                      variant="action"
                      size="sm"
                      data-testid={`btn-revertir-pase-${alumno.id}`}
                      onClick={() => handleRevertirPase(alumno.id)}
                      title="Revertir pase"
                    >
                      Revertir pase
                    </Button>
                  ) : (
                    <Button
                      variant="action"
                      size="sm"
                      data-testid={`btn-pase-${alumno.id}`}
                      onClick={() => setPaseTarget(alumno)}
                      title="Registrar pase"
                    >
                      Pase
                    </Button>
                  )}

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

                  {/* Constancia — disabled when the student has a pase (not eligible, REQ-8) */}
                  <Button
                    variant="action"
                    size="sm"
                    data-testid={`btn-constancia-${alumno.id}`}
                    onClick={() => handleOpenConstancia(alumno)}
                    disabled={!!alumno.fechaDePase}
                    title={
                      alumno.fechaDePase
                        ? 'El alumno tiene un pase registrado'
                        : 'Generar constancia de alumno regular'
                    }
                  >
                    Constancia
                  </Button>

                  {/* Quitar — disabled when the student has a pase (business rule) */}
                  <Button
                    variant="danger-soft"
                    size="sm"
                    data-testid={`btn-remove-alumno-${alumno.id}`}
                    onClick={() => handleRemove(alumno.id)}
                    disabled={!!alumno.fechaDePase}
                    title={alumno.fechaDePase ? 'No se puede quitar un alumno con pase registrado' : undefined}
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

      {/* Modal de constancia de alumno regular */}
      <Modal
        open={constanciaTarget !== null}
        title="Constancia de Alumno Regular"
        onClose={handleCerrarConstancia}
        size="md"
      >
        <div data-testid="modal-constancia">
          <p style={{ marginBottom: '1rem', fontSize: 'var(--text-sm)' }}>
            Alumno: <strong>{constanciaTarget?.studentName}</strong>
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="input-constancia-destinatario"
              style={{ ...labelStyle, display: 'block', marginBottom: '0.25rem' }}
            >
              Destinatario
            </label>
            <textarea
              id="input-constancia-destinatario"
              data-testid="input-constancia-destinatario"
              value={constanciaDestinatario}
              onChange={(e) => setConstanciaDestinatario(e.target.value)}
              rows={3}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.375rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-sm)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="input-constancia-fecha"
              style={{ ...labelStyle, display: 'block', marginBottom: '0.25rem' }}
            >
              Fecha de emisión
            </label>
            <input
              id="input-constancia-fecha"
              type="date"
              data-testid="input-constancia-fecha"
              value={constanciaFecha}
              onChange={(e) => setConstanciaFecha(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.375rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCerrarConstancia}
            >
              Cancelar
            </Button>
            <Button
              variant="action"
              size="sm"
              data-testid="btn-constancia-imprimir"
              onClick={handleConstanciaImprimir}
            >
              Imprimir
            </Button>
            <Button
              variant="primary"
              size="sm"
              data-testid="btn-constancia-descargar"
              onClick={handleConstanciaDescargar}
            >
              Descargar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de fecha de pase — reuses the shared Modal component */}
      <Modal
        open={paseTarget !== null}
        title="Registrar pase"
        onClose={handleCancelarPase}
        size="md"
      >
        <div data-testid="modal-pase">
          <p style={{ marginBottom: '1rem', fontSize: 'var(--text-sm)' }}>
            Alumno: <strong>{paseTarget?.studentName}</strong>
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="input-pase-fecha"
              style={{ ...labelStyle, display: 'block', marginBottom: '0.25rem' }}
            >
              Fecha de pase
            </label>
            <input
              id="input-pase-fecha"
              type="date"
              data-testid="input-fecha-pase"
              max={todayIso}
              value={paseFecha}
              onChange={(e) => setPaseFecha(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.375rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-sm)',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button
              variant="ghost"
              size="sm"
              data-testid="btn-cancelar-pase"
              onClick={handleCancelarPase}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              data-testid="btn-confirmar-pase"
              disabled={!paseFecha}
              onClick={handleConfirmarPase}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
