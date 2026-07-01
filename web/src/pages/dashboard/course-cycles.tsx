import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useCourseCycles, useCreateCourseCycle, useUpdateCourseCycle, useDeleteCourseCycle } from '../../hooks/useCourseCycles';
import type { CourseCycle, CreateCourseCycleDto, UpdateCourseCycleDto } from '../../types/course-cycle';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Modal } from '../../components/ui/modal';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import CourseCycleForm from '../../components/course-cycle/CourseCycleForm';
import apiClient from '../../api/client';
import { downloadBoletinBatch } from '../../hooks/useBoletin';
import { AlumnosCursoCicloPanel } from './components/AlumnosCursoCicloPanel';
import { isManagementUser } from '../../types/materia-grupo';
import { useGradingPhase } from '../../hooks/useGradingPhase';
import {
  GRADING_PHASE_OPTIONS,
  GRADING_PHASE_LABELS,
  gradingPhaseStatusLabel,
  type GradingPhaseValue,
} from './components/grading-phase-utils';

interface Institution { id: string; name: string; }

interface BulkCascadeResult {
  studentsProcessed: number;
  studentsFailed: number;
  materiasCreated: number;
  materiasSkipped: number;
  competenciasCreated: number;
  competenciasSkipped: number;
}

const LEVEL_LABELS: Record<number, string> = {
  10: 'Inicial', 11: 'Talleres Inicial', 12: 'Bilingüismo Inicial',
  20: 'Primario', 21: 'Talleres Primario', 22: 'Bilingüismo Primario',
  30: 'Secundario', 31: 'Talleres Secundario', 32: 'Bilingüismo Secundario',
  40: 'Terciario',
};

const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Levels that support the bimester grading phase (Capacidad A): Primario (20-22) + Secundario (30-32). */
const CAN_GRADE_PHASE_LEVELS = [20, 21, 22, 30, 31, 32];

/**
 * GradingPhasePopupBody — Modal content for activating/changing the bimester grading phase.
 * Shows the 5 activatable phases (1er..4to Bimestre + Cierre), marking the active one.
 */
function GradingPhasePopupBody({ ccId }: { ccId: string }) {
  const { gradingPhase, loading, saving, error, setPhase } = useGradingPhase(ccId);

  if (loading) {
    return <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>;
  }

  return (
    <div>
      <p style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
        Fase activa: <strong>{gradingPhaseStatusLabel(gradingPhase as GradingPhaseValue)}</strong>
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        {GRADING_PHASE_OPTIONS.map((code) => {
          const active = gradingPhase === code;
          return (
            <Button
              key={code}
              variant={active ? 'action' : 'ghost'}
              size="sm"
              aria-pressed={active}
              disabled={saving}
              onClick={() => setPhase(code)}
            >
              {GRADING_PHASE_LABELS[code]}
            </Button>
          );
        })}
      </div>
      {error && (
        <p style={{ color: 'var(--color-danger)', marginTop: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '0.5rem', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)', color: 'var(--color-text)',
  fontSize: 'var(--text-sm)', minWidth: '160px',
};

export default function CourseCyclesPage() {
  const { user } = useAuth();
  const { config } = useInstitution();
  const isRoot = user?.roles?.includes('ROOT') ?? false;

  const userInstitutionId = user?.institutionId ?? config.id ?? '';
  const [institutionId, setInstitutionId] = useState(userInstitutionId);
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  const [filters, setFilters] = useState({ level: '', cycleId: '', studyPlanId: '' });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CourseCycle | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [boletinBatchCcId, setBoletinBatchCcId] = useState<string | null>(null);
  const [alumnosPanelCcId, setAlumnosPanelCcId] = useState<string | null>(null);
  const [gradingPhaseCcId, setGradingPhaseCcId] = useState<string | null>(null);
  const [confirmCascadeCcId, setConfirmCascadeCcId] = useState<string | null>(null);
  const [cascadingBulkCcId, setCascadingBulkCcId] = useState<string | null>(null);

  const handleBoletinBatch = async (ccId: string) => {
    setBoletinBatchCcId(ccId);
    try {
      await downloadBoletinBatch(ccId);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setToast({
        message: err?.response?.data?.error?.message ?? 'Error al descargar boletines',
        type: 'error',
      });
    } finally {
      setBoletinBatchCcId(null);
    }
  };

  const queryParams: Record<string, string> = {};
  if (institutionId) queryParams.institutionId = institutionId;
  if (filters.level) queryParams.level = filters.level;
  // Only send cycleId to the backend when it is a valid UUID — the API rejects non-UUID values.
  // Non-UUID cycleIds (legacy string IDs) are filtered client-side below.
  if (filters.cycleId && isUUID(filters.cycleId)) queryParams.cycleId = filters.cycleId;
  // studyPlanId is sent but the backend currently ignores it; client-side filter below handles it.
  if (filters.studyPlanId) queryParams.studyPlanId = filters.studyPlanId;

  const { data: rawData, loading, reload } = useCourseCycles(Object.keys(queryParams).length > 0 ? queryParams : undefined);

  // Client-side filters for values the backend does not handle:
  // – non-UUID cycleIds (backend returns 400 for those; we skip sending them and filter here)
  // – studyPlanId (backend ignores this param entirely)
  const data = rawData.filter(cc => {
    if (filters.cycleId && !isUUID(filters.cycleId) && cc.cycleId !== filters.cycleId) return false;
    if (filters.studyPlanId && cc.studyPlanId !== filters.studyPlanId) return false;
    return true;
  });
  const { creating, createError, create } = useCreateCourseCycle();
  const { updating, updateError, update } = useUpdateCourseCycle();
  const { deleting, del } = useDeleteCourseCycle();

  useEffect(() => {
    if (isRoot) {
      apiClient.get('/institutions').then(r => setInstitutions(r.data?.data ?? [])).catch(() => {});
    }
  }, [isRoot]);

  const [cycles, setCycles] = useState<{ uuid: string; name: string }[]>([]);
  useEffect(() => {
    const cycleParams: Record<string, string> = { limit: '100' };
    if (institutionId) cycleParams.institutionId = institutionId;
    if (filters.level) cycleParams.level = String(Math.floor(parseInt(filters.level) / 10));
    cycleParams.active = 'true';
    apiClient.get('/academic-cycles', { params: cycleParams }).then((r) => setCycles(r.data?.data ?? []));
  }, [institutionId, filters.level]);

  const [studyPlans, setStudyPlans] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const planParams: Record<string, string> = { limit: '100' };
    if (institutionId) planParams.institutionId = institutionId;
    if (filters.level) planParams.level = String(Math.floor(parseInt(filters.level) / 10));
    apiClient.get('/study-plans', { params: planParams }).then((r) => setStudyPlans(r.data?.data ?? []));
  }, [institutionId, filters.level]);

  const handleInstitutionChange = (newId: string) => {
    setInstitutionId(newId);
    setFilters({ level: '', cycleId: '', studyPlanId: '' });
  };

  const handleLevelChange = (newLevel: string) => {
    setFilters((f) => ({ ...f, level: newLevel, studyPlanId: '' }));
  };

  const handleCreate = async (data: CreateCourseCycleDto | UpdateCourseCycleDto) => {
    const ok = await create(data as CreateCourseCycleDto);
    if (ok) { setShowForm(false); reload(); }
    return ok;
  };

  const handleUpdate = async (data: UpdateCourseCycleDto) => {
    if (!editing) return false;
    const ok = await update(editing.uuid, data);
    if (ok) { setEditing(null); reload(); }
    return ok;
  };

  const handleDelete = async (uuid: string) => {
    const ok = await del(uuid);
    if (ok) reload();
  };

  /**
   * handleBulkCascade — POST /course-cycles/:ccId/alumnos/cascade
   * Materializes all plan materias + active competencies for ALL enrolled students.
   * Best-effort: backend accumulates partial failures; never throws at batch level.
   * Always-enabled (ADR-B4): empty CC returns zeros — harmless no-op.
   * SDD asignacion-cascade-masiva T-03, SC-11..15.
   */
  const handleBulkCascade = async (ccId: string) => {
    setConfirmCascadeCcId(null);
    setCascadingBulkCcId(ccId);
    try {
      const res = await apiClient.post<{ data: BulkCascadeResult }>(
        `/course-cycles/${ccId}/alumnos/cascade`,
      );
      const counts = res.data?.data;
      if (counts) {
        setToast({
          message: `${counts.materiasCreated} materias y ${counts.competenciasCreated} competencias asignadas a ${counts.studentsProcessed} alumnos`,
          type: 'success',
        });
      }
    } catch {
      setToast({ message: 'Error al asignar materias y competencias', type: 'error' });
    } finally {
      setCascadingBulkCcId(null);
    }
  };

  const handleGenerate = async () => {
    if (!filters.level || !filters.cycleId || !filters.studyPlanId) return;
    setGenerating(true);
    try {
      const payload: Record<string, string | number> = {
        level: parseInt(filters.level, 10),
        cycleId: filters.cycleId,
      };
      if (filters.studyPlanId) {
        payload.studyPlanId = filters.studyPlanId;
      }
      const res = await apiClient.post('/course-cycles/generate', payload, {
        params: institutionId ? { institutionId } : undefined,
      });
      const result = res.data?.data as { created: number; updated: number; total: number };
      setToast({
        message: `Creados: ${result.created} | Actualizados: ${result.updated} | Total: ${result.total}`,
        type: 'success',
      });
      reload();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setToast({
        message: err?.response?.data?.error?.message ?? 'Error al generar cursos',
        type: 'error',
      });
    } finally {
      setGenerating(false);
    }
  };

  const tableData = data.map((cc) => ({
    courseName: cc.courseName,
    level: LEVEL_LABELS[cc.level] ?? `Nivel ${cc.level}`,
    cycle: cycles.find((c) => c.uuid === cc.cycleId)?.name ?? cc.cycleId,
    active: cc.active,
    passingGrade: cc.passingGrade,
    studentCount: cc.studentCount ?? 0,
    actions: cc,
  }));

  return (
    <div>
      <PremiumHeader
        title="Cursos por Ciclo"
        subtitle="Administrá los cursos de cada plan de estudio por ciclo lectivo"
        icon="📚"
        stats={[{ label: 'cursos', value: String(data.length) }]}
      />

      {/* Institution selector */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', marginBottom: 'var(--space-md)' }}>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Institución</label>
          {isRoot ? (
            <select value={institutionId} onChange={(e) => handleInstitutionChange(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '220px' }}>
              <option value="">Todas las instituciones</option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          ) : (
            <input type="text" value={institutions.find(i => i.id === institutionId)?.name || config.name || institutionId} disabled
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', minWidth: '220px' }} />
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Nivel</label>
            <select value={filters.level} onChange={(e) => handleLevelChange(e.target.value)} style={selectStyle}>
              <option value="">Todos</option>
              <option value="10">Inicial</option>
              <option value="20">Primario</option>
              <option value="30">Secundario</option>
              <option value="40">Terciario</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Ciclo Lectivo</label>
            <select value={filters.cycleId} onChange={(e) => setFilters((f) => ({ ...f, cycleId: e.target.value }))} style={{ ...selectStyle, minWidth: '200px' }}>
              <option value="">Todos</option>
              {cycles.map((c) => <option key={c.uuid} value={c.uuid}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Plan de Estudio</label>
            <select value={filters.studyPlanId} onChange={(e) => setFilters((f) => ({ ...f, studyPlanId: e.target.value }))} style={{ ...selectStyle, minWidth: '220px' }}>
              <option value="">Todos</option>
              {studyPlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginLeft: 'var(--space-sm)' }}>
            <Button
              onClick={handleGenerate}
              disabled={!filters.level || !filters.cycleId || !filters.studyPlanId || generating}
              data-testid="generate-btn"
            >
              {generating ? 'Generando...' : 'Generar Cursos'}
            </Button>
          </div>
        </div>
      </Card>

      {/* F7-D1/D2: Regeneration warning — shown when CCs already exist for the current filter */}
      {data.length > 0 && (
        <div
          data-testid="regen-warning"
          style={{
            marginTop: 'var(--space-md)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: '#fefce8',
            border: '1px solid #fde68a',
            color: '#92400e',
            fontSize: 'var(--text-sm)',
          }}
        >
          <strong>Atención:</strong> Este curso ya fue generado. Al volver a generar se agregarán las
          materias faltantes del plan y se re-sincronizarán las descripciones. No se tocarán
          notas, grupos ni alumnos ya cargados.
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <CourseCycleForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            loading={creating}
            error={createError}
          />
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <CourseCycleForm
            initial={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            loading={updating}
            error={updateError}
          />
        </div>
      )}

      {/* Table */}
      <Card className="mt-lg">
        {loading && <p className="text-muted-foreground">Cargando...</p>}
        {!loading && data.length === 0 && <p className="text-muted-foreground">No hay cursos por ciclo.</p>}
        {!loading && data.length > 0 && (
          <Table
            columns={[
              { key: 'courseName', header: 'Curso' },
              { key: 'level', header: 'Nivel' },
              { key: 'cycle', header: 'Ciclo Lectivo' },
              { key: 'active', header: 'Activo', render: (item) => (
                <span style={{
                  display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)', fontWeight: 500,
                  background: item.active ? '#dcfce7' : '#fee2e2',
                  color: item.active ? '#16a34a' : '#dc2626',
                }}>
                  {item.active ? 'Sí' : 'No'}
                </span>
              )},
              { key: 'passingGrade', header: 'Nota Aprob.' },
              { key: 'studentCount', header: 'Alumnos' },
              { key: 'actions', header: '', render: (item) => {
                const cc = item.actions;
                return (
                <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                  {/* F7-N1: link to Materias del Ciclo */}
                  <Link to={`/course-cycles/${cc.uuid}/materias`}>
                    <Button variant="action" size="sm">Materias</Button>
                  </Link>
                  <Button
                    variant="action"
                    size="sm"
                    data-testid={`btn-alumnos-${cc.uuid}`}
                    onClick={() =>
                      setAlumnosPanelCcId((prev) => (prev === cc.uuid ? null : cc.uuid))
                    }
                  >
                    Alumnos
                  </Button>
                  <Button
                    variant="action"
                    size="sm"
                    data-testid={`btn-bulk-cascade-${cc.uuid}`}
                    disabled={cascadingBulkCcId === cc.uuid || (cc.studentCount ?? 0) === 0}
                    title={(cc.studentCount ?? 0) === 0 ? 'El curso no tiene alumnos inscriptos' : undefined}
                    onClick={() => setConfirmCascadeCcId(cc.uuid)}
                  >
                    Asignar materias y competencias
                  </Button>
                  <Button
                    variant="action"
                    size="sm"
                    data-testid={`btn-boletines-${cc.uuid}`}
                    disabled={boletinBatchCcId === cc.uuid || (cc.studentCount ?? 0) === 0}
                    loading={boletinBatchCcId === cc.uuid}
                    title={(cc.studentCount ?? 0) === 0 ? 'El curso no tiene alumnos inscriptos' : 'Descargar boletines imprimibles del curso (ZIP)'}
                    onClick={() => handleBoletinBatch(cc.uuid)}
                  >
                    📄 Boletines
                  </Button>
                  {isManagementUser(user?.roles) && CAN_GRADE_PHASE_LEVELS.includes(cc.level) && (
                    <Button
                      variant="action"
                      size="sm"
                      data-testid={`btn-grading-phase-${cc.uuid}`}
                      onClick={() => setGradingPhaseCcId(cc.uuid)}
                    >
                      Fase de Calificación
                    </Button>
                  )}
                  <Button variant="action" size="sm" onClick={() => setEditing(cc)}>Editar</Button>
                  <Button variant="danger-soft" size="sm" onClick={() => handleDelete(cc.uuid)} loading={deleting}>Eliminar</Button>
                </div>
              )}},
            ]}
            data={tableData}
          />
        )}
      </Card>

      {/* Alumnos del Ciclo — popup modal above the listing */}
      <Modal
        open={!!alumnosPanelCcId}
        title="Alumnos del Ciclo"
        size="lg"
        onClose={() => setAlumnosPanelCcId(null)}
      >
        {alumnosPanelCcId && (
          <AlumnosCursoCicloPanel
            ccId={alumnosPanelCcId}
            onClose={() => setAlumnosPanelCcId(null)}
            embedded
          />
        )}
      </Modal>

      {/* Fase de Calificación — popup modal above the listing (Capacidad A) */}
      <Modal
        open={!!gradingPhaseCcId}
        title="Fase de Calificación"
        size="md"
        onClose={() => setGradingPhaseCcId(null)}
      >
        {gradingPhaseCcId && <GradingPhasePopupBody ccId={gradingPhaseCcId} />}
      </Modal>

      {/* Bulk cascade confirmation dialog */}
      <Modal
        open={!!confirmCascadeCcId}
        title="Asignar materias y competencias"
        size="md"
        onClose={() => setConfirmCascadeCcId(null)}
      >
        <div style={{ padding: 'var(--space-md)' }}>
          <p style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
            ¿Asignar materias y competencias a todos los alumnos del curso?
            La operación es idempotente y no modifica notas existentes.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => setConfirmCascadeCcId(null)}>
              Cancelar
            </Button>
            <Button
              variant="action"
              size="sm"
              data-testid="btn-confirm-bulk-cascade"
              onClick={() => confirmCascadeCcId && handleBulkCascade(confirmCascadeCcId)}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9999,
            padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)',
            background: toast.type === 'success' ? '#16a34a' : '#dc2626',
            color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', maxWidth: '400px', cursor: 'pointer',
          }}
          onClick={() => setToast(null)}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
