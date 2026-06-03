import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useCourseCycles, useCreateCourseCycle, useUpdateCourseCycle, useDeleteCourseCycle, useToggleCourseCycleActive } from '../../hooks/useCourseCycles';
import type { CourseCycle, CreateCourseCycleDto, UpdateCourseCycleDto } from '../../types/course-cycle';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import CourseCycleForm from '../../components/course-cycle/CourseCycleForm';
import apiClient from '../../api/client';

interface Institution { id: string; name: string; }

const LEVEL_LABELS: Record<number, string> = {
  10: 'Inicial', 11: 'Talleres Inicial', 12: 'Bilingüismo Inicial',
  20: 'Primario', 21: 'Talleres Primario', 22: 'Bilingüismo Primario',
  30: 'Secundario', 31: 'Talleres Secundario', 32: 'Bilingüismo Secundario',
  40: 'Terciario',
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
  const { toggling, toggle } = useToggleCourseCycleActive();

  // Fetch institutions for ROOT
  useEffect(() => {
    if (isRoot) {
      apiClient.get('/institutions').then(r => setInstitutions(r.data?.data ?? [])).catch(() => {});
    }
  }, [isRoot]);

  const [cycles, setCycles] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const cycleParams: Record<string, string> = { limit: '100' };
    if (institutionId) cycleParams.institutionId = institutionId;
    if (filters.level) cycleParams.level = String(Math.floor(parseInt(filters.level) / 10));
    cycleParams.active = 'true';
    apiClient.get('/academic-cycles', { params: cycleParams }).then((r) => setCycles(r.data?.data ?? []));
  }, [institutionId, filters.level]);

  // Load study plans filtered by institution + level
  // Note: study-plans API expects level as simple number (1-4), not composite code (10-40)
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

  const handleCreate = async (data: CreateCourseCycleDto) => {
    const ok = await create(data as any);
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

  const handleToggle = async (cc: CourseCycle) => {
    const ok = await toggle(cc.uuid, !cc.active);
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
      const res = await apiClient.post('/course-cycles/generate', payload);
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
    cycle: cycles.find((c) => c.id === cc.cycleId)?.name ?? cc.cycleId,
    active: cc.active,
    passingGrade: cc.passingGrade,
    actions: cc,
  }));

  return (
    <div className="p-6 space-y-4">
      <PremiumHeader
        title="Cursos por Ciclo"
        subtitle="Administrá los cursos de cada plan de estudio por ciclo lectivo"
      />

      {/* Institution selector */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', marginBottom: 'var(--space-md)' }}>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>
            Institución
          </label>
          {isRoot ? (
            <select
              value={institutionId}
              onChange={(e) => handleInstitutionChange(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            >
              <option value="">Todas las instituciones</option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={institutions.find(i => i.id === institutionId)?.name || config.name || institutionId}
              disabled
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            />
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Nivel</label>
            <select
              value={filters.level}
              onChange={(e) => handleLevelChange(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '160px' }}
            >
              <option value="">Todos</option>
              <option value="10">Inicial</option>
              <option value="20">Primario</option>
              <option value="30">Secundario</option>
              <option value="40">Terciario</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Ciclo Lectivo</label>
            <select
              value={filters.cycleId}
              onChange={(e) => setFilters((f) => ({ ...f, cycleId: e.target.value }))}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '200px' }}
            >
              <option value="">Todos</option>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Plan de Estudio</label>
            <select
              value={filters.studyPlanId}
              onChange={(e) => setFilters((f) => ({ ...f, studyPlanId: e.target.value }))}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            >
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
        <Card className="p-4">
          <CourseCycleForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            loading={creating}
            error={createError}
          />
        </Card>
      )}

      {/* Edit Form */}
      {editing && (
        <Card className="p-4">
          <CourseCycleForm
            initial={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            loading={updating}
            error={updateError}
          />
        </Card>
      )}

      {/* Table */}
      <Card className="p-4">
        {loading && <p className="text-muted-foreground">Cargando...</p>}
        {!loading && data.length === 0 && <p className="text-muted-foreground">No hay cursos por ciclo.</p>}
        {!loading && data.length > 0 && (
          <Table
            columns={[
              { key: 'courseName', label: 'Curso' },
              { key: 'level', label: 'Nivel' },
              { key: 'cycle', label: 'Ciclo Lectivo' },
              { key: 'active', label: 'Activo', render: (v: boolean) => (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${v ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {v ? 'Sí' : 'No'}
                </span>
              )},
              { key: 'passingGrade', label: 'Nota Aprob.' },
              { key: 'actions', label: 'Acciones', render: (cc: CourseCycle) => (
                <div className="flex gap-1">
                  <button onClick={() => setEditing(cc)} className="text-blue-600 hover:underline text-sm">Editar</button>
                  <button onClick={() => handleToggle(cc)} disabled={toggling} className="text-orange-600 hover:underline text-sm">
                    {cc.active ? 'Cerrar' : 'Abrir'}
                  </button>
                  <button onClick={() => handleDelete(cc.uuid)} disabled={deleting} className="text-red-600 hover:underline text-sm">Eliminar</button>
                </div>
              )},
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
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', maxWidth: '400px',
          }}
          onClick={() => setToast(null)}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
