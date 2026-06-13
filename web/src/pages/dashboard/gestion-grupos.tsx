/**
 * GestionGruposPage — Gestión de Grupos
 *
 * Route: /grupos
 *
 * Pantalla global de gestión de grupos: listado, filtros en cascada,
 * CRUD (crear, editar, borrar), gestión de alumnos por grupo e impresión.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import apiClient from '../../api/client';
import { extractErrorMessage } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { LEVEL_CATALOG, LEVEL_LABELS } from '../../constants/levels';
import PremiumPrintReport, { buildBranding } from '../../components/reports/PremiumPrintReport';

// ── Local types ───────────────────────────────────────────────────────────────

interface Institution { id: string; name: string; }

interface Grupo {
  id: string;
  name: string | null;
  docenteName: string;
  docenteUserId: string;
  materiaId: string;
  subjectName: string;
  courseCycleId: string;
  courseName: string;
  level: number;
  alumnosCount: number;
}

interface CourseCycle {
  id?: string;
  uuid?: string;
  name?: string;
  courseName?: string;
  level?: number;
}

interface Materia {
  id: string;
  subjectName: string;
}

interface Teacher {
  id: string;
  name: string;
}

interface AlumnoItem {
  id: string;
  studentId: string;
  studentName: string;
}

interface FormState {
  mode: 'create' | 'edit';
  grupoId?: string;
  name: string;
  docenteUserId: string;
  formLevel: string;
  formCourseCycleId: string;
  formMateriaId: string;
  saving: boolean;
  saveError: string;
  grupoAlumnos: AlumnoItem[];
  materiaAlumnos: AlumnoItem[];
  loadingAlumnos: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: '0.5rem', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)', color: 'var(--color-text)',
  fontSize: 'var(--text-sm)', minWidth: '160px',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GestionGruposPage() {
  const { user } = useAuth();
  const { config } = useInstitution();

  const roles: string[] = user?.roles ?? [];
  const isRoot = roles.includes('ROOT');

  // Institution
  const userInstitutionId = user?.institutionId ?? config.id ?? '';
  const [institutionId, setInstitutionId] = useState(userInstitutionId);
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  // Helper: agrega institutionId como query param en llamadas tenant-scoped.
  // Para ROOT sin institución seleccionada queda undefined → el middleware devuelve 403
  // de forma visible (no silenciosa).
  const tenantParams = institutionId ? { institutionId } : undefined;

  useEffect(() => {
    apiClient.get('/institutions').then(r => setInstitutions(r.data?.data ?? [])).catch(() => {});
  }, []);

  // Available levels for this user
  const userLevelCodes = (user?.userLevels ?? []).map((ul: { level: number; modality: number }) => ul.level * 10 + ul.modality);
  const availableLevels = isRoot
    ? LEVEL_CATALOG.filter(e => e.pedagogical)
    : LEVEL_CATALOG.filter(e => e.pedagogical && userLevelCodes.includes(e.code));

  // ── Filtros ───────────────────────────────────────────────────────────────

  const [filterLevel, setFilterLevel] = useState('');
  const [filterCourseCycleId, setFilterCourseCycleId] = useState('');
  const [filterMateriaId, setFilterMateriaId] = useState('');
  const [filterCourseCycles, setFilterCourseCycles] = useState<CourseCycle[]>([]);
  const [filterMaterias, setFilterMaterias] = useState<Materia[]>([]);

  // ── Grupos ────────────────────────────────────────────────────────────────

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);

  // ── Form ──────────────────────────────────────────────────────────────────

  const [formState, setFormState] = useState<FormState | null>(null);
  const [formCourseCycles, setFormCourseCycles] = useState<CourseCycle[]>([]);
  const [formMaterias, setFormMaterias] = useState<Materia[]>([]);
  const [formTeachers, setFormTeachers] = useState<Teacher[]>([]);

  // ── Delete / Print ────────────────────────────────────────────────────────

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [printGrupo, setPrintGrupo] = useState<Grupo | null>(null);
  const [printAlumnos, setPrintAlumnos] = useState<AlumnoItem[]>([]);

  // ── Reload grupos ─────────────────────────────────────────────────────────

  const reloadGrupos = useCallback(() => {
    setLoadingGrupos(true);
    const params: Record<string, string> = {};
    if (filterLevel) params.level = filterLevel;
    if (filterCourseCycleId) params.courseCycleId = filterCourseCycleId;
    if (filterMateriaId) params.materiaId = filterMateriaId;
    if (institutionId) params.institutionId = institutionId;
    apiClient.get('/grupos', { params })
      .then(r => setGrupos(r.data?.data ?? r.data ?? []))
      .catch((err) => { console.error('[reloadGrupos] GET /grupos:', err); setGrupos([]); })
      .finally(() => setLoadingGrupos(false));
  }, [filterLevel, filterCourseCycleId, filterMateriaId, institutionId]);

  // ── Filter handlers ───────────────────────────────────────────────────────

  function handleFilterLevelChange(val: string) {
    setFilterLevel(val);
    setFilterCourseCycleId('');
    setFilterMateriaId('');
    setFilterCourseCycles([]);
    setFilterMaterias([]);
  }

  function handleFilterCCChange(val: string) {
    setFilterCourseCycleId(val);
    setFilterMateriaId('');
    setFilterMaterias([]);
  }

  // ── Effects: filtros cascada ──────────────────────────────────────────────

  useEffect(() => {
    if (!filterLevel) { setFilterCourseCycles([]); return; }
    const params: Record<string, string> = { level: filterLevel };
    if (institutionId) params.institutionId = institutionId;
    apiClient.get('/course-cycles', { params })
      .then(r => setFilterCourseCycles(r.data?.data ?? r.data ?? []))
      .catch(() => {});
  }, [filterLevel, institutionId]);

  useEffect(() => {
    if (!filterCourseCycleId) { setFilterMaterias([]); return; }
    apiClient.get(`/course-cycles/${filterCourseCycleId}/materias`, { params: tenantParams })
      .then(r => setFilterMaterias(r.data?.data ?? r.data ?? []))
      .catch((err) => console.error('[filter materias] GET:', err));
  }, [filterCourseCycleId, institutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect: cargar grupos cuando cambia un filtro ─────────────────────────

  useEffect(() => {
    setLoadingGrupos(true);
    const params: Record<string, string> = {};
    if (filterLevel) params.level = filterLevel;
    if (filterCourseCycleId) params.courseCycleId = filterCourseCycleId;
    if (filterMateriaId) params.materiaId = filterMateriaId;
    if (institutionId) params.institutionId = institutionId;
    apiClient.get('/grupos', { params })
      .then(r => setGrupos(r.data?.data ?? r.data ?? []))
      .catch((err) => { console.error('[grupos effect] GET /grupos:', err); setGrupos([]); })
      .finally(() => setLoadingGrupos(false));
  }, [filterLevel, filterCourseCycleId, filterMateriaId, institutionId]);

  // ── Effects: form cascada ─────────────────────────────────────────────────

  // CCs del form
  useEffect(() => {
    if (!formState?.formLevel) { setFormCourseCycles([]); return; }
    const params: Record<string, string> = { level: formState.formLevel };
    if (institutionId) params.institutionId = institutionId;
    apiClient.get('/course-cycles', { params })
      .then(r => setFormCourseCycles(r.data?.data ?? r.data ?? []))
      .catch(() => {});
  }, [formState?.formLevel, institutionId]);

  // Materias del form
  useEffect(() => {
    if (!formState?.formCourseCycleId) { setFormMaterias([]); return; }
    apiClient.get(`/course-cycles/${formState.formCourseCycleId}/materias`, { params: tenantParams })
      .then(r => setFormMaterias(r.data?.data ?? r.data ?? []))
      .catch((err) => console.error('[form materias] GET:', err));
  }, [formState?.formCourseCycleId, institutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Teachers del form
  useEffect(() => {
    if (!formState?.formMateriaId) { setFormTeachers([]); return; }
    const params: Record<string, string> = { role: 'TEACHER' };
    if (institutionId) params.institutionId = institutionId;
    apiClient.get('/users', { params })
      .then(r => setFormTeachers(r.data?.data ?? r.data ?? []))
      .catch(() => {});
  }, [formState?.formMateriaId, institutionId]);

  // Alumnos del form (edit mode)
  useEffect(() => {
    if (!formState?.grupoId || !formState?.formMateriaId || !formState?.formCourseCycleId) return;
    setFormState(f => f ? { ...f, loadingAlumnos: true } : null);
    Promise.all([
      apiClient.get(`/grupos/${formState.grupoId}/alumnos`, { params: tenantParams }),
      apiClient.get(`/course-cycles/${formState.formCourseCycleId}/materias/${formState.formMateriaId}/alumnos`, { params: tenantParams }),
    ]).then(([grupoR, materiaR]) => {
      const grupoAlumnos: AlumnoItem[] = grupoR.data?.data ?? grupoR.data ?? [];
      const materiaAlumnos: AlumnoItem[] = materiaR.data?.data ?? materiaR.data ?? [];
      setFormState(f => f ? { ...f, grupoAlumnos, materiaAlumnos, loadingAlumnos: false } : null);
    }).catch((err) => {
      console.error('[form alumnos] GET:', err);
      setFormState(f => f ? { ...f, loadingAlumnos: false } : null);
    });
  }, [formState?.grupoId, formState?.formMateriaId, formState?.formCourseCycleId, institutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Form handlers ─────────────────────────────────────────────────────────

  function handleFormLevelChange(val: string) {
    setFormState(f => f ? { ...f, formLevel: val, formCourseCycleId: '', formMateriaId: '', docenteUserId: '' } : null);
    setFormCourseCycles([]);
    setFormMaterias([]);
    setFormTeachers([]);
  }

  function handleFormCCChange(val: string) {
    setFormState(f => f ? { ...f, formCourseCycleId: val, formMateriaId: '', docenteUserId: '' } : null);
    setFormMaterias([]);
    setFormTeachers([]);
  }

  function handleFormMateriaChange(val: string) {
    setFormState(f => f ? { ...f, formMateriaId: val, docenteUserId: '' } : null);
    setFormTeachers([]);
  }

  async function handleFormSubmit() {
    if (!formState) return;
    setFormState(f => f ? { ...f, saving: true, saveError: '' } : null);
    try {
      if (formState.mode === 'create') {
        const res = await apiClient.post(
          `/course-cycles/${formState.formCourseCycleId}/materias/${formState.formMateriaId}/grupos`,
          { userId: formState.docenteUserId, ...(formState.name ? { name: formState.name } : {}) },
          { params: tenantParams }
        );
        const newId = res.data?.id ?? res.data?.data?.id;
        if (newId) {
          setFormState(f => f ? { ...f, mode: 'edit', grupoId: newId, saving: false } : null);
        } else {
          setFormState(f => f ? { ...f, saving: false } : null);
          reloadGrupos();
        }
      } else {
        await apiClient.patch(`/grupos/${formState.grupoId}`, {
          ...(formState.name ? { name: formState.name } : {}),
          userId: formState.docenteUserId,
        }, { params: tenantParams });
        setFormState(null);
        reloadGrupos();
      }
    } catch (err: unknown) {
      setFormState(f => f ? { ...f, saving: false, saveError: extractErrorMessage(err) } : null);
    }
  }

  async function handleDelete(id: string) {
    await apiClient.delete(`/grupos/${id}`, { params: tenantParams });
    reloadGrupos();
    setDeleteConfirmId(null);
  }

  async function handlePrint(grupo: Grupo) {
    const r = await apiClient.get(`/grupos/${grupo.id}/alumnos`, { params: tenantParams });
    const alumnos: AlumnoItem[] = r.data?.data ?? r.data ?? [];
    setPrintAlumnos(alumnos);
    setPrintGrupo(grupo);
  }

  async function handleAddAlumno(alumnoXMateriaId: string) {
    if (!formState?.grupoId) return;
    await apiClient.post(`/grupos/${formState.grupoId}/alumnos`, { alumnosXMateriaXCursoXCicloId: alumnoXMateriaId }, { params: tenantParams });
    if (formState.formMateriaId && formState.formCourseCycleId) {
      const [grupoR, materiaR] = await Promise.all([
        apiClient.get(`/grupos/${formState.grupoId}/alumnos`, { params: tenantParams }),
        apiClient.get(`/course-cycles/${formState.formCourseCycleId}/materias/${formState.formMateriaId}/alumnos`, { params: tenantParams }),
      ]);
      const grupoAlumnos: AlumnoItem[] = grupoR.data?.data ?? grupoR.data ?? [];
      const materiaAlumnos: AlumnoItem[] = materiaR.data?.data ?? materiaR.data ?? [];
      setFormState(f => f ? { ...f, grupoAlumnos, materiaAlumnos } : null);
    }
  }

  // ── Helpers para abrir form ───────────────────────────────────────────────

  function openCreateForm() {
    setFormState({
      mode: 'create',
      name: '',
      docenteUserId: '',
      formLevel: filterLevel,
      formCourseCycleId: filterCourseCycleId,
      formMateriaId: filterMateriaId,
      saving: false,
      saveError: '',
      grupoAlumnos: [],
      materiaAlumnos: [],
      loadingAlumnos: false,
    });
  }

  function openEditForm(grupo: Grupo) {
    // Derivar formLevel desde el campo level del grupo
    const lvl = String(grupo.level);
    setFormState({
      mode: 'edit',
      grupoId: grupo.id,
      name: grupo.name ?? '',
      docenteUserId: grupo.docenteUserId ?? '',
      formLevel: lvl,
      formCourseCycleId: grupo.courseCycleId ?? '',
      formMateriaId: grupo.materiaId ?? '',
      saving: false,
      saveError: '',
      grupoAlumnos: [],
      materiaAlumnos: [],
      loadingAlumnos: false,
    });
  }

  // ── Alumnos no asignados (form) ───────────────────────────────────────────

  const assignedIds = new Set((formState?.grupoAlumnos ?? []).map((a: AlumnoItem) => a.id));
  const unassignedAlumnos = (formState?.materiaAlumnos ?? []).filter((a: AlumnoItem) => !assignedIds.has(a.id));

  // ── CC label helper ───────────────────────────────────────────────────────

  function ccLabel(cc: CourseCycle): string {
    return cc.courseName ?? cc.name ?? cc.uuid ?? cc.id ?? '';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PremiumHeader
        title="Gestión de Grupos"
        subtitle="Administrá los grupos de cada materia"
      />

      {/* ROOT: selector de institución */}
      {isRoot && institutions.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: 'var(--text-sm)', marginRight: '0.5rem' }}>Institución:</label>
          <select
            value={institutionId}
            onChange={e => setInstitutionId(e.target.value)}
            style={selectStyle}
          >
            <option value="">— Seleccioná institución —</option>
            {institutions.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select
          data-testid="filter-level"
          value={filterLevel}
          onChange={e => handleFilterLevelChange(e.target.value)}
          style={selectStyle}
        >
          <option value="">— Todos los niveles —</option>
          {availableLevels.map(l => (
            <option key={l.code} value={String(l.code)}>{l.label}</option>
          ))}
        </select>

        <select
          data-testid="filter-course-cycle"
          value={filterCourseCycleId}
          onChange={e => handleFilterCCChange(e.target.value)}
          style={selectStyle}
          disabled={!filterLevel}
        >
          <option value="">— Todos los cursos —</option>
          {filterCourseCycles.map(cc => (
            <option key={cc.uuid ?? cc.id} value={cc.uuid ?? cc.id ?? ''}>{ccLabel(cc)}</option>
          ))}
        </select>

        <select
          data-testid="filter-materia"
          value={filterMateriaId}
          onChange={e => setFilterMateriaId(e.target.value)}
          style={selectStyle}
          disabled={!filterCourseCycleId}
        >
          <option value="">— Todas las materias —</option>
          {filterMaterias.map(m => (
            <option key={m.id} value={m.id}>{m.subjectName}</option>
          ))}
        </select>
      </div>

      {/* Tabla de grupos */}
      <Card>
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>Grupos</span>
            <Button data-testid="btn-crear-grupo" onClick={openCreateForm}>
              Crear Grupo
            </Button>
          </div>

          {loadingGrupos && (
            <p style={{ color: 'var(--color-text-muted)' }}>Cargando grupos...</p>
          )}

          {!loadingGrupos && grupos.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)' }}>Sin grupos encontrados.</p>
          )}

          {!loadingGrupos && grupos.length > 0 && (() => {
            // Agrupar por materia para que el nombre de materia aparezca UNA sola vez
            const grouped = grupos.reduce((acc, g) => {
              const key = g.subjectName;
              if (!acc[key]) acc[key] = [];
              acc[key].push(g);
              return acc;
            }, {} as Record<string, Grupo[]>);

            return (
              <>
                {Object.entries(grouped).map(([subject, subjectGrupos]) => (
                  <div key={subject} style={{ marginBottom: '1rem' }}>
                    <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '0.5rem' }}>
                      {subject}
                    </p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                          <th style={{ padding: '0.5rem' }}>Nombre</th>
                          <th style={{ padding: '0.5rem' }}>Docente</th>
                          <th style={{ padding: '0.5rem' }}>Curso</th>
                          <th style={{ padding: '0.5rem' }}>Nivel</th>
                          <th style={{ padding: '0.5rem' }}>Alumnos</th>
                          <th style={{ padding: '0.5rem' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjectGrupos.map(grupo => (
                          <tr
                            key={grupo.id}
                            data-testid="grupo-row"
                            style={{ borderBottom: '1px solid var(--color-border)' }}
                          >
                            <td style={{ padding: '0.5rem' }}>{grupo.name ?? '—'}</td>
                            <td style={{ padding: '0.5rem' }}>{grupo.docenteName}</td>
                            <td style={{ padding: '0.5rem' }}>{grupo.courseName}</td>
                            <td style={{ padding: '0.5rem' }}>{LEVEL_LABELS[grupo.level] ?? grupo.level}</td>
                            <td style={{ padding: '0.5rem' }}>{grupo.alumnosCount}</td>
                            <td style={{ padding: '0.5rem', display: 'flex', gap: '0.25rem' }}>
                              <Button
                                size="sm"
                                variant="action"
                                data-testid={`btn-editar-${grupo.id}`}
                                onClick={() => openEditForm(grupo)}
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="danger-soft"
                                data-testid={`btn-borrar-${grupo.id}`}
                                onClick={() => setDeleteConfirmId(grupo.id)}
                              >
                                Borrar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                data-testid={`btn-imprimir-${grupo.id}`}
                                onClick={() => handlePrint(grupo)}
                              >
                                Imprimir
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      </Card>

      {/* Confirmación de borrado */}
      {deleteConfirmId !== null && (
        <div
          data-testid="confirm-delete"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
          }}
        >
          <div style={{
            background: 'var(--color-surface)', padding: '2rem', borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)', minWidth: '320px',
          }}>
            <p style={{ marginBottom: '1rem' }}>¿Confirmás que querés borrar este grupo?</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="danger-soft"
                data-testid="btn-confirm-delete"
                onClick={() => handleDelete(deleteConfirmId!)}
              >
                Confirmar
              </Button>
              <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario crear/editar */}
      {formState !== null && (
        <div
          data-testid="form-grupo"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            zIndex: 500, overflowY: 'auto', paddingTop: '2rem',
          }}
        >
          <div style={{
            background: 'var(--color-surface)', padding: '2rem', borderRadius: 'var(--radius-md)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)', minWidth: '400px', maxWidth: '600px', width: '100%',
          }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>
              {formState.mode === 'create' ? 'Crear grupo' : 'Editar grupo'}
            </h3>

            {/* Cascada: nivel */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: 'var(--text-sm)', display: 'block', marginBottom: '0.25rem' }}>Nivel</label>
              <select
                value={formState.formLevel}
                onChange={e => handleFormLevelChange(e.target.value)}
                style={{ ...selectStyle, width: '100%' }}
              >
                <option value="">— Seleccioná un nivel —</option>
                {availableLevels.map(l => (
                  <option key={l.code} value={String(l.code)}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Cascada: curso/ciclo */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: 'var(--text-sm)', display: 'block', marginBottom: '0.25rem' }}>Curso / Ciclo</label>
              <select
                value={formState.formCourseCycleId}
                onChange={e => handleFormCCChange(e.target.value)}
                style={{ ...selectStyle, width: '100%' }}
                disabled={!formState.formLevel}
              >
                <option value="">— Seleccioná un curso —</option>
                {formCourseCycles.map(cc => (
                  <option key={cc.uuid ?? cc.id} value={cc.uuid ?? cc.id ?? ''}>{ccLabel(cc)}</option>
                ))}
              </select>
            </div>

            {/* Cascada: materia */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: 'var(--text-sm)', display: 'block', marginBottom: '0.25rem' }}>Materia</label>
              <select
                value={formState.formMateriaId}
                onChange={e => handleFormMateriaChange(e.target.value)}
                style={{ ...selectStyle, width: '100%' }}
                disabled={!formState.formCourseCycleId}
              >
                <option value="">— Seleccioná una materia —</option>
                {formMaterias.map(m => (
                  <option key={m.id} value={m.id}>{m.subjectName}</option>
                ))}
              </select>
            </div>

            {/* Nombre */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: 'var(--text-sm)', display: 'block', marginBottom: '0.25rem' }}>Nombre (opcional)</label>
              <input
                data-testid="form-nombre"
                type="text"
                value={formState.name}
                onChange={e => setFormState(f => f ? { ...f, name: e.target.value } : null)}
                placeholder="Nombre del grupo (opcional)"
                style={{ ...selectStyle, width: '100%' }}
              />
            </div>

            {/* Docente */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: 'var(--text-sm)', display: 'block', marginBottom: '0.25rem' }}>Docente</label>
              <select
                value={formState.docenteUserId}
                onChange={e => setFormState(f => f ? { ...f, docenteUserId: e.target.value } : null)}
                style={{ ...selectStyle, width: '100%' }}
                disabled={!formState.formMateriaId}
              >
                <option value="">— Seleccioná un docente —</option>
                {formTeachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Sección alumnos — solo en modo edición con materia y CC seleccionados */}
            {formState.mode === 'edit' && formState.formMateriaId && formState.formCourseCycleId && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ fontWeight: 500, fontSize: 'var(--text-sm)', marginBottom: '0.5rem' }}>
                  Alumnos del grupo ({(formState.grupoAlumnos ?? []).length})
                </p>

                {formState.loadingAlumnos && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Cargando alumnos...</p>
                )}

                {!formState.loadingAlumnos && (formState.grupoAlumnos ?? []).length > 0 && (
                  <ul style={{ margin: '0 0 0.5rem 0', padding: '0 0 0 1rem', fontSize: 'var(--text-sm)' }}>
                    {(formState.grupoAlumnos ?? []).map((a: AlumnoItem) => (
                      <li key={a.id}>{a.studentName}</li>
                    ))}
                  </ul>
                )}

                {!formState.loadingAlumnos && unassignedAlumnos.length > 0 && (
                  <div>
                    <p style={{ fontWeight: 500, fontSize: 'var(--text-sm)', marginBottom: '0.25rem' }}>
                      Agregar alumnos:
                    </p>
                    {unassignedAlumnos.map((a: AlumnoItem) => (
                      <div
                        key={a.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-surface-2, #f8fafc)', marginBottom: '0.25rem',
                        }}
                      >
                        <span style={{ fontSize: 'var(--text-sm)' }}>{a.studentName}</span>
                        <Button
                          size="sm"
                          variant="action"
                          data-testid={`btn-add-alumno-${a.id}`}
                          onClick={() => handleAddAlumno(a.id)}
                        >
                          +
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {formState.saveError && (
              <p style={{ color: '#dc2626', fontSize: 'var(--text-sm)', marginBottom: '0.5rem' }}>
                {formState.saveError}
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                onClick={handleFormSubmit}
                disabled={formState.saving}
              >
                {formState.saving ? 'Guardando...' : formState.mode === 'create' ? 'Crear' : 'Guardar'}
              </Button>
              <Button variant="ghost" onClick={() => setFormState(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Vista de impresión */}
      {printGrupo && (
        <PremiumPrintReport
          branding={buildBranding(config)}
          systemSubtitle="Gestión de Grupos"
          reportTitle={`Grupo: ${printGrupo.name ?? 'Sin nombre'} — ${printGrupo.subjectName}`}
          emissionDate={new Date().toLocaleDateString('es-AR')}
        >
          <div style={{ marginBottom: '1rem' }}>
            <strong>Docente:</strong> {printGrupo.docenteName} &nbsp;|&nbsp;
            <strong>Materia:</strong> {printGrupo.subjectName} &nbsp;|&nbsp;
            <strong>Curso:</strong> {printGrupo.courseName} &nbsp;|&nbsp;
            <strong>Nivel:</strong> {LEVEL_LABELS[printGrupo.level] ?? printGrupo.level}
          </div>
          <table className="ppr-table">
            <thead>
              <tr><th>#</th><th>Alumno</th></tr>
            </thead>
            <tbody>
              {printAlumnos.map((a, i) => (
                <tr key={a.id}><td>{i + 1}</td><td>{a.studentName}</td></tr>
              ))}
              {printAlumnos.length === 0 && (
                <tr><td colSpan={2} style={{ textAlign: 'center', color: '#94a3b8' }}>Sin alumnos</td></tr>
              )}
            </tbody>
          </table>
          <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
            Total alumnos: {printAlumnos.length}
          </div>
        </PremiumPrintReport>
      )}
      {printGrupo && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000 }}>
          <Button onClick={() => setPrintGrupo(null)}>Cerrar</Button>
        </div>
      )}
    </div>
  );
}
