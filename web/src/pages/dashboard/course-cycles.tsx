import { useState, useCallback, useEffect } from 'react';
import { useCourseCycles, useCreateCourseCycle, useUpdateCourseCycle, useDeleteCourseCycle, useToggleCourseCycleActive } from '../../hooks/useCourseCycles';
import type { CourseCycle, CreateCourseCycleDto, UpdateCourseCycleDto } from '../../types/course-cycle';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import CourseCycleForm from '../../components/course-cycle/CourseCycleForm';
import GenerateCourseCyclesModal from '../../components/course-cycle/GenerateCourseCyclesModal';
import apiClient from '../../api/client';

const LEVEL_LABELS: Record<number, string> = {
  10: 'Inicial', 11: 'Talleres Inicial', 12: 'Bilingüismo Inicial',
  20: 'Primario', 21: 'Talleres Primario', 22: 'Bilingüismo Primario',
  30: 'Secundario', 31: 'Talleres Secundario', 32: 'Bilingüismo Secundario',
  40: 'Terciario',
};

export default function CourseCyclesPage() {
  const [filters, setFilters] = useState({ level: '', cycleId: '', active: '' });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CourseCycle | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const params: Record<string, string> = {};
  if (filters.level) params.level = filters.level;
  if (filters.cycleId) params.cycleId = filters.cycleId;
  if (filters.active) params.active = filters.active;

  const { data, loading, reload } = useCourseCycles(Object.keys(params).length > 0 ? params : undefined);
  const { creating, createError, create } = useCreateCourseCycle();
  const { updating, updateError, update } = useUpdateCourseCycle();
  const { deleting, del } = useDeleteCourseCycle();
  const { toggling, toggle } = useToggleCourseCycleActive();

  const [cycles, setCycles] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    apiClient.get('/academic-cycles?limit=100').then((r) => setCycles(r.data?.data ?? []));
  }, []);

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

  const handleGenerated = useCallback((_result: unknown) => {
    reload();
  }, [reload]);

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

      {/* Filters */}
      <Card className="p-4">
        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Nivel</label>
            <select
              value={filters.level}
              onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}
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
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Estado</label>
            <select
              value={filters.active}
              onChange={(e) => setFilters((f) => ({ ...f, active: e.target.value }))}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '140px' }}
            >
              <option value="">Todos</option>
              <option value="true">Activo</option>
              <option value="false">Cerrado</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginLeft: 'var(--space-sm)' }}>
            <Button onClick={() => { setShowGenerateModal(true); }}>Generar Cursos</Button>
            <Button onClick={() => { setEditing(null); setShowForm(!showForm); }}>
              {showForm ? 'Cancelar' : 'Nuevo Curso por Ciclo'}
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

      {/* Generate Modal */}
      <GenerateCourseCyclesModal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerated={handleGenerated}
      />
    </div>
  );
}
