import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import {
  useAcademicCycles,
  useCreateAcademicCycle,
  useUpdateAcademicCycle,
  useDeleteAcademicCycle,
  useToggleAcademicCycleActive,
} from '../../hooks/useAcademicCycles';
import type { AcademicCycle, CreateAcademicCycleDto } from '../../types/academic-cycle';
import apiClient from '../../api/client';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const LEVEL_LABELS: Record<number, string> = {
  1: 'Inicial', 2: 'Primario', 3: 'Secundario', 4: 'Terciario',
};

const BIMONTH_FIELDS = [
  { key: 'first', label: '1er Bimestre' },
  { key: 'second', label: '2do Bimestre' },
  { key: 'third', label: '3er Bimestre' },
  { key: 'fourth', label: '4to Bimestre' },
] as const;

interface Institution { id: string; name: string; }

const SELECT_STYLE: React.CSSProperties = {
  padding: '0.5rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: 'var(--text-sm)',
  width: '100%',
};

const DISABLED_INPUT_STYLE: React.CSSProperties = {
  ...SELECT_STYLE,
  background: '#f8fafc',
  color: '#64748b',
};

export default function AcademicCyclesPage() {
  const { user } = useAuth();
  const { config } = useInstitution();
  const isRoot = user?.roles?.includes('ROOT') ?? false;

  const userInstitutionId = config.id ?? '';

  const [institutionId, setInstitutionId] = useState(userInstitutionId);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [filters, setFilters] = useState({ level: '', active: '' });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AcademicCycle | null>(null);

  // Fetch institutions for ROOT
  useEffect(() => {
    if (isRoot) {
      apiClient.get('/institutions').then(r => {
        setInstitutions(r.data?.data ?? []);
      }).catch(() => {});
    }
  }, [isRoot]);

  const params: Record<string, string> = {};
  if (filters.level) params.level = filters.level;
  if (filters.active) params.active = filters.active;

  const { data, loading, reload } = useAcademicCycles(institutionId, Object.keys(params).length > 0 ? params : undefined);
  const { creating, createError, create, setCreateError } = useCreateAcademicCycle(institutionId);
  const { updating, updateError, update, setUpdateError } = useUpdateAcademicCycle(institutionId);
  const { deleting, del } = useDeleteAcademicCycle(institutionId);
  const { toggling, toggle } = useToggleAcademicCycleActive(institutionId);

  const [form, setForm] = useState<CreateAcademicCycleDto>({
    code: '', name: '', level: 2, startDate: '', endDate: '',
  });

  const resetForm = () => {
    setForm({ code: '', name: '', level: 2, startDate: '', endDate: '' });
    setEditing(null);
    setShowForm(false);
    setCreateError('');
    setUpdateError('');
  };

  const openEdit = (cycle: AcademicCycle) => {
    setEditing(cycle);
    setForm({
      code: cycle.code,
      name: cycle.name,
      level: cycle.level,
      startDate: cycle.startDate?.split('T')[0] ?? '',
      endDate: cycle.endDate?.split('T')[0] ?? '',
      firstBimonthStart: cycle.firstBimonthStart?.split('T')[0] ?? '',
      firstBimonthEnd: cycle.firstBimonthEnd?.split('T')[0] ?? '',
      secondBimonthStart: cycle.secondBimonthStart?.split('T')[0] ?? '',
      secondBimonthEnd: cycle.secondBimonthEnd?.split('T')[0] ?? '',
      thirdBimonthStart: cycle.thirdBimonthStart?.split('T')[0] ?? '',
      thirdBimonthEnd: cycle.thirdBimonthEnd?.split('T')[0] ?? '',
      fourthBimonthStart: cycle.fourthBimonthStart?.split('T')[0] ?? '',
      fourthBimonthEnd: cycle.fourthBimonthEnd?.split('T')[0] ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionId) {
      setCreateError('Seleccioná una institución');
      return;
    }
    if (editing) {
      const ok = await update(editing.uuid, form as any);
      if (ok) { resetForm(); reload(); }
    } else {
      const ok = await create(form as any);
      if (ok) { resetForm(); reload(); }
    }
  };

  const handleDelete = async (uuid: string) => {
    if (!confirm('¿Eliminar este ciclo lectivo?')) return;
    const ok = await del(uuid);
    if (ok) reload();
  };

  const handleToggle = async (cycle: AcademicCycle) => {
    const ok = await toggle(cycle.uuid);
    if (ok) reload();
  };

  const formTitle = editing ? 'Editar Ciclo Lectivo' : 'Nuevo Ciclo Lectivo';
  const instName = institutions.find(i => i.id === institutionId)?.name || config.name || institutionId;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ciclos Lectivos</h1>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          + Nuevo Ciclo
        </Button>
      </div>

      {/* Institution selector */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>
            Institución
          </label>
          {isRoot ? (
            <select
              value={institutionId}
              onChange={e => { setInstitutionId(e.target.value); }}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            >
              <option value="">Todas las instituciones</option>
              {institutions.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={instName}
              disabled
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            />
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-end' }}>
          <div style={{ minWidth: '240px' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Nivel</label>
            <select
              style={SELECT_STYLE}
              value={filters.level}
              onChange={(e) => setFilters({ ...filters, level: e.target.value })}
            >
              <option value="">Todos</option>
              {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: '200px' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Estado</label>
            <select
              style={SELECT_STYLE}
              value={filters.active}
              onChange={(e) => setFilters({ ...filters, active: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
          <Button variant="ghost" onClick={() => { setFilters({ level: '', active: '' }); reload(); }} style={{ marginTop: '1.25rem' }}>
            Limpiar
          </Button>
        </div>
      </Card>

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{formTitle}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Institution (form) */}
            <div>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>
                Institución
              </label>
              {isRoot ? (
                <select
                  value={institutionId}
                  onChange={e => setInstitutionId(e.target.value)}
                  style={SELECT_STYLE}
                >
                  <option value="">Seleccionar institución</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={instName}
                  disabled
                  style={DISABLED_INPUT_STYLE}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Código *</label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="2026"
                  maxLength={15}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ciclo Lectivo 2026"
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Nivel *</label>
                <select
                  style={SELECT_STYLE}
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) })}
                >
                  {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Inicio *</label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha Fin *</label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
              </div>
            </div>

            {/* Bimonth dates */}
            <details className="mt-4">
              <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                Fechas de Bimestre (opcional)
              </summary>
              <div className="grid grid-cols-2 gap-4 mt-3">
                {BIMONTH_FIELDS.map(({ key, label }) => (
                  <div key={key} className="border rounded p-3 space-y-2">
                    <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500">Inicio</label>
                        <Input
                          type="date"
                          value={(form as any)[`${key}BimonthStart`] ?? ''}
                          onChange={(e) => setForm({ ...form, [`${key}BimonthStart`]: e.target.value || undefined } as any)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">Fin</label>
                        <Input
                          type="date"
                          value={(form as any)[`${key}BimonthEnd`] ?? ''}
                          onChange={(e) => setForm({ ...form, [`${key}BimonthEnd`]: e.target.value || undefined } as any)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>

            {(createError || updateError) && (
              <p className="text-sm text-red-600">{createError || updateError}</p>
            )}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" disabled={creating || updating}>
                {creating || updating ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Table */}
      <Card>
        {loading ? (
          <p className="p-6 text-gray-500">Cargando...</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Nivel</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-500 py-6">No hay ciclos lectivos</td></tr>
              ) : (
                data.map((cycle) => (
                  <tr key={cycle.uuid}>
                    <td className="font-mono text-sm">{cycle.code}</td>
                    <td className="font-medium">{cycle.name}</td>
                    <td>{LEVEL_LABELS[cycle.level] ?? cycle.level}</td>
                    <td className="text-sm">{new Date(cycle.startDate).toLocaleDateString()}</td>
                    <td className="text-sm">{new Date(cycle.endDate).toLocaleDateString()}</td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cycle.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {cycle.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(cycle)}>Editar</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleToggle(cycle)} disabled={toggling}>
                          {cycle.active ? 'Desactivar' : 'Activar'}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(cycle.uuid)} disabled={deleting}>
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
