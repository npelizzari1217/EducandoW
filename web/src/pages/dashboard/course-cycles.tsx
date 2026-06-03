import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useCourseCycles, useCreateCourseCycle, useUpdateCourseCycle, useDeleteCourseCycle } from '../../hooks/useCourseCycles';
import type { CourseCycle, CreateCourseCycleDto, UpdateCourseCycleDto } from '../../types/course-cycle';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import CourseCycleForm from '../../components/course-cycle/CourseCycleForm';
import apiClient from '../../api/client';

interface Institution { id: string; name: string; }

const LEVEL_LABELS: Record<number, string> = {
  10: 'Inicial', 11: 'Talleres Inicial', 12: 'Bilingüismo Inicial',
  20: 'Primario', 21: 'Talleres Primario', 22: 'Bilingüismo Primario',
  30: 'Secundario', 31: 'Talleres Secundario', 32: 'Bilingüismo Secundario',
  40: 'Terciario',
};

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

  const queryParams: Record<string, string> = {};
  if (institutionId) queryParams.institutionId = institutionId;
  if (filters.level) queryParams.level = filters.level;
  if (filters.cycleId) queryParams.cycleId = filters.cycleId;
  if (filters.studyPlanId) queryParams.studyPlanId = filters.studyPlanId;

  const { data, loading, reload } = useCourseCycles(Object.keys(queryParams).length > 0 ? queryParams : undefined);
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
    const ok = await update(editing.uuid, data as any);
    if (ok) { setEditing(null); reload(); }
    return ok;
  };

  const handleDelete = async (uuid: string) => {
    const ok = await del(uuid);
    if (ok) reload();
  };

  const handleGenerate = async () => {
    if (!filters.level || !filters.cycleId) return;
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
    } catch (e: any) {
      setToast({
        message: e?.response?.data?.error?.message ?? 'Error al generar cursos',
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
    actions: cc,
  }));

  return (
    <div>
      <PremiumHeader
        title="Cursos por Ciclo"
        subtitle="Administrá los cursos de cada plan de estudio por ciclo lectivo"
        icon="📚"
        stats={[{ label: 'cursos', value: String(data.length) }]}
      >
        <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => { setShowForm(!showForm); setEditing(null); }}>
          {showForm ? 'Cancelar' : 'Nuevo curso por ciclo'}
        </Button>
      </PremiumHeader>

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
              disabled={!filters.level || !filters.cycleId || generating}
              data-testid="generate-btn"
            >
              {generating ? 'Generando...' : 'Generar Cursos'}
            </Button>
          </div>
        </div>
      </Card>

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
              { key: 'actions', header: '', render: (item) => {
                const cc = item.actions;
                return (
                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                  <Button variant="action" size="sm" onClick={() => setEditing(cc)}>Editar</Button>
                  <Button variant="danger-soft" size="sm" onClick={() => handleDelete(cc.uuid)} loading={deleting}>Eliminar</Button>
                </div>
              )}},
            ]}
            data={tableData}
          />
        )}
      </Card>

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
