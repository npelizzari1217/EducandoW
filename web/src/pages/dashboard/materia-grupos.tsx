/**
 * MateriasGruposPage — Phase 7 UI
 *
 * Route: /course-cycles/:ccId/materias
 *
 * Shows materias for a CursoXCiclo with their grupos.
 * - GRADES module required (redirect otherwise — F7-N3)
 * - TEACHER: sees only their grupos (role filter — F7-R1)
 * - SECRETARIO/DIRECTOR/ADMIN/ROOT: sees all grupos (F7-R2)
 * - "Asignar docente a grupo" button hidden for TEACHER (F7-R3)
 * - GrupoSelector shown when grupos.length > 1 (F7-G2)
 * - Grupos loaded upfront (no click required — better UX for small lists)
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { useCan } from '../../hooks/use-can';
import apiClient from '../../api/client';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import PremiumHeader from '../../components/ui/premium-header';
import { GrupoSelector } from './components/GrupoSelector';
import type { MateriaXCursoXCiclo, GrupoXCursoXMateriaXCiclo } from '../../types/materia-grupo';
import { isManagementUser } from '../../types/materia-grupo';

interface MateriaWithGrupos {
  materia: MateriaXCursoXCiclo;
  grupos: GrupoXCursoXMateriaXCiclo[];
  loadingGrupos: boolean;
  selectedGrupoId: string | null;
}

export default function MateriasGruposPage() {
  const { ccId } = useParams<{ ccId: string }>();
  const { user } = useAuth();
  const { can } = useCan();

  // F7-N3: GRADES module required
  if (!can('GRADES', 'READ')) {
    return <Navigate to="/" replace />;
  }

  const isManagement = isManagementUser(user?.roles);

  const [rows, setRows] = useState<MateriaWithGrupos[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showAsignacionPanel, setShowAsignacionPanel] = useState(false);

  // Fetch grupos for a single materia
  const fetchGrupos = useCallback(
    (materiaId: string) => {
      apiClient
        .get<{ data: GrupoXCursoXMateriaXCiclo[] }>(
          `/course-cycles/${ccId}/materias/${materiaId}/grupos`,
        )
        .then((res) => {
          const allGrupos: GrupoXCursoXMateriaXCiclo[] = res.data?.data ?? [];

          // F7-R1: TEACHER sees only their own grupos; management sees all
          const filteredGrupos = isManagement
            ? allGrupos
            : allGrupos.filter((g) => g.userId === user?.id);

          setRows((prev) =>
            prev.map((row) => {
              if (row.materia.id !== materiaId) return row;
              const selectedGrupoId =
                filteredGrupos.length === 1 ? filteredGrupos[0].id : null;
              return { ...row, grupos: filteredGrupos, loadingGrupos: false, selectedGrupoId };
            }),
          );
        })
        .catch(() => {
          setRows((prev) =>
            prev.map((row) =>
              row.materia.id === materiaId ? { ...row, grupos: [], loadingGrupos: false } : row,
            ),
          );
        });
    },
    [ccId, isManagement, user?.id],
  );

  // Fetch materias and immediately trigger grupo fetches
  useEffect(() => {
    if (!ccId) return;
    setLoading(true);
    apiClient
      .get<{ data: MateriaXCursoXCiclo[] }>(`/course-cycles/${ccId}/materias`)
      .then((res) => {
        const materias: MateriaXCursoXCiclo[] = res.data?.data ?? [];
        // Initialize all rows with loadingGrupos: true
        setRows(
          materias.map((m) => ({
            materia: m,
            grupos: [],
            loadingGrupos: true,
            selectedGrupoId: null,
          })),
        );
        // Fetch grupos for each materia in parallel
        materias.forEach((m) => fetchGrupos(m.id));
      })
      .catch(() => {
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [ccId, fetchGrupos]);

  const handleCreateGrupo = async (materiaId: string) => {
    if (!ccId) return;
    try {
      await apiClient.post(`/course-cycles/${ccId}/materias/${materiaId}/grupos`, {
        userId: user?.id,
      });
      setToast({ message: 'Grupo creado exitosamente', type: 'success' });
      // Refresh grupos for this materia
      setRows((prev) =>
        prev.map((row) =>
          row.materia.id === materiaId ? { ...row, loadingGrupos: true } : row,
        ),
      );
      fetchGrupos(materiaId);
    } catch {
      setToast({ message: 'Error al crear el grupo', type: 'error' });
    }
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontWeight: 500,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div>
      <PremiumHeader
        title="Materias del Ciclo"
        subtitle="Gestioná los grupos y docentes por materia"
        icon="📖"
        stats={[{ label: 'materias', value: String(rows.length) }]}
      />

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <Link
          to="/course-cycles"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary)', textDecoration: 'none' }}
        >
          ← Volver a Cursos por Ciclo
        </Link>
      </div>

      {/* Panel de asignaciones de preceptor/titular — management only */}
      {isManagement && (
        <Card className="p-4 mb-md">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500 }}>Asignaciones del Curso (Preceptor / Titular)</span>
            <Button
              variant="action"
              size="sm"
              onClick={() => setShowAsignacionPanel((v) => !v)}
              data-testid="btn-asignacion-curso"
            >
              {showAsignacionPanel ? 'Ocultar' : 'Gestionar Asignaciones'}
            </Button>
          </div>
          {showAsignacionPanel && (
            <AsignacionCursoPanelInline ccId={ccId ?? ''} />
          )}
        </Card>
      )}

      {loading && <p style={{ color: 'var(--color-text-muted)' }}>Cargando materias...</p>}
      {!loading && rows.length === 0 && (
        <Card className="p-4">
          <p style={{ color: 'var(--color-text-muted)' }}>
            No hay materias cargadas para este curso. Generá el curso para materializar las materias del plan.
          </p>
        </Card>
      )}

      {rows.map(({ materia, grupos, loadingGrupos, selectedGrupoId }) => (
        <Card key={materia.id} className="mt-md">
          <div style={{ padding: 'var(--space-md)' }}>
            {/* Materia header */}
            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>
                {materia.subjectName}
              </span>
              <span style={{ marginLeft: 'var(--space-md)', ...labelStyle }}>
                {materia.alumnosCount} alumnos · {materia.gruposCount} grupo{materia.gruposCount !== 1 ? 's' : ''}
              </span>
            </div>

            {loadingGrupos && <p style={{ ...labelStyle }}>Cargando grupos...</p>}

            {!loadingGrupos && grupos.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                No hay grupos para esta materia.
              </p>
            )}

            {/* F7-G2: GrupoSelector visible only when > 1 group */}
            {!loadingGrupos && grupos.length > 1 && (
              <div style={{ marginBottom: 'var(--space-sm)' }}>
                <label style={{ ...labelStyle, display: 'block', marginBottom: '0.25rem' }}>
                  Grupo
                </label>
                <GrupoSelector
                  grupos={grupos}
                  selectedId={selectedGrupoId}
                  onChange={(id) =>
                    setRows((prev) =>
                      prev.map((r) =>
                        r.materia.id === materia.id ? { ...r, selectedGrupoId: id } : r,
                      )
                    )
                  }
                />
              </div>
            )}

            {/* Grupos list */}
            {!loadingGrupos && grupos.map((grupo) => (
              <div
                key={grupo.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-sm) var(--space-md)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-surface-2, #f8fafc)',
                  marginBottom: 'var(--space-xs)',
                }}
              >
                <div>
                  <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>
                    {grupo.name ?? `Grupo de ${grupo.docenteName ?? 'docente'}`}
                  </span>
                  {grupo.docenteName && (
                    <span style={{ marginLeft: 'var(--space-sm)', ...labelStyle }}>
                      {grupo.docenteName}
                    </span>
                  )}
                  {grupo.alumnosCount !== undefined && (
                    <span style={{ marginLeft: 'var(--space-sm)', ...labelStyle }}>
                      {grupo.alumnosCount} alumnos
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                  <Button variant="action" size="sm">
                    Notas
                  </Button>
                  <Button variant="action" size="sm">
                    Ausencias
                  </Button>
                </div>
              </div>
            ))}

            {/* F7-R3: Asignar docente button — hidden for TEACHER, visible for management */}
            {isManagement && !loadingGrupos && (
              <div style={{ marginTop: 'var(--space-sm)' }}>
                <Button
                  variant="action"
                  size="sm"
                  data-testid="btn-asignar-docente"
                  onClick={() => handleCreateGrupo(materia.id)}
                >
                  + Asignar docente a grupo
                </Button>
              </div>
            )}
          </div>
        </Card>
      ))}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9999,
            padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)',
            background: toast.type === 'success' ? '#16a34a' : '#dc2626',
            color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', cursor: 'pointer',
          }}
          onClick={() => setToast(null)}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── Inline panel for Asignacion Curso (preceptor / titular) ─────────────────

interface AsignacionCursoPanelProps {
  ccId: string;
}

interface AsignacionDto {
  id: string;
  rol: string;
  turno: string | null;
  docenteName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

function AsignacionCursoPanelInline({ ccId }: AsignacionCursoPanelProps) {
  const [asignaciones, setAsignaciones] = useState<AsignacionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formUserId, setFormUserId] = useState('');
  const [formRol, setFormRol] = useState<'PRECEPTOR' | 'TITULAR'>('PRECEPTOR');
  const [formTurno, setFormTurno] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .get<{ data: AsignacionDto[] }>(`/course-cycles/${ccId}/asignaciones`)
      .then((res) => setAsignaciones(res.data?.data ?? []))
      .catch(() => setAsignaciones([]))
      .finally(() => setLoading(false));
  }, [ccId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAssign = async () => {
    if (!formUserId) return;
    setSaving(true);
    try {
      await apiClient.post(`/course-cycles/${ccId}/asignaciones`, {
        userId: formUserId,
        rol: formRol,
        turno: formTurno || undefined,
      });
      setShowForm(false);
      setFormUserId('');
      setFormTurno('');
      load();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    await apiClient.delete(`/course-cycles/${ccId}/asignaciones/${id}`);
    load();
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-xs)',
    fontWeight: 500,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
  };

  const inputStyle: React.CSSProperties = {
    padding: '0.375rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 'var(--text-sm)',
    width: '100%',
  };

  return (
    <div style={{ marginTop: 'var(--space-md)' }}>
      {loading && <p style={{ ...labelStyle }}>Cargando asignaciones...</p>}

      {!loading && asignaciones.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          No hay asignaciones. Asigná un preceptor o titular para este curso.
        </p>
      )}

      {asignaciones.map((a) => (
        <div
          key={a.id}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 'var(--space-xs) var(--space-sm)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface-2, #f8fafc)',
            marginBottom: 'var(--space-xs)',
          }}
        >
          <div>
            <span style={{ fontWeight: 500, fontSize: 'var(--text-sm)' }}>
              {a.docenteName ?? (`${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || 'Docente')}
            </span>
            <span style={{ marginLeft: 'var(--space-sm)', ...labelStyle }}>
              {a.rol} {a.turno ? `· ${a.turno}` : ''}
            </span>
          </div>
          <Button variant="danger-soft" size="sm" onClick={() => handleRemove(a.id)}>
            Quitar
          </Button>
        </div>
      ))}

      {!showForm && (
        <Button variant="action" size="sm" onClick={() => setShowForm(true)} style={{ marginTop: 'var(--space-sm)' }}>
          + Asignar preceptor / titular
        </Button>
      )}

      {showForm && (
        <div
          style={{
            marginTop: 'var(--space-md)',
            padding: 'var(--space-md)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'grid', gap: 'var(--space-sm)', gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: '0.25rem' }}>
                Usuario (userId)
              </label>
              <input
                type="text"
                value={formUserId}
                onChange={(e) => setFormUserId(e.target.value)}
                placeholder="ID del docente"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, display: 'block', marginBottom: '0.25rem' }}>
                Rol
              </label>
              <select
                value={formRol}
                onChange={(e) => setFormRol(e.target.value as 'PRECEPTOR' | 'TITULAR')}
                style={inputStyle}
              >
                <option value="PRECEPTOR">Preceptor</option>
                <option value="TITULAR">Titular</option>
              </select>
            </div>
            <div>
              {/* F7-U3: turno is optional — D2 */}
              <label style={{ ...labelStyle, display: 'block', marginBottom: '0.25rem' }}>
                Turno (opcional)
              </label>
              <select
                value={formTurno}
                onChange={(e) => setFormTurno(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Sin turno —</option>
                <option value="MANANA">Mañana</option>
                <option value="TARDE">Tarde</option>
                <option value="VESPERTINO">Vespertino</option>
                <option value="NOCHE">Noche</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-xs)' }}>
            <Button onClick={handleAssign} disabled={!formUserId || saving}>
              {saving ? 'Guardando...' : 'Asignar'}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
