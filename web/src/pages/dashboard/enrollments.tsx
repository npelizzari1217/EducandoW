import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiDelete, useApiCreate } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import apiClient from '../../api/client';
import { downloadBoletin } from '../../hooks/useBoletin';

interface Institution { id: string; name: string; }

export default function EnrollmentsPage() {
  const { user } = useAuth();
  const { config } = useInstitution();
  const isRoot = user?.roles?.includes('ROOT');
  const userInstitutionId = user?.institutionId ?? config.id ?? '';

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [filters, setFilters] = useState({ studentId: '', institutionId: userInstitutionId });
  const params: Record<string, string> | undefined = filters.studentId ? { studentId: filters.studentId } : filters.institutionId ? { institutionId: filters.institutionId } : undefined;
  const { data, loading, reload } = useApiList<Record<string, unknown>>('/enrollments', params);
  const { deleting, del } = useApiDelete('/enrollments');
  const { creating, createError, create } = useApiCreate('/enrollments');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', institutionId: filters.institutionId, level: 'INICIAL', academicYear: String(new Date().getFullYear()), grade: '', division: '' });
  const [toggling, setToggling] = useState(false);
  const [bulkCycleId, setBulkCycleId] = useState('');

  const handleToggleFlag = useCallback(async (enrollmentId: string, flag: 'printable' | 'promoted') => {
    setToggling(true);
    try { await apiClient.patch(`/enrollments/${enrollmentId}/flags`, { flag }); reload(); }
    catch { /* silently fail — reload will show server state */ }
    finally { setToggling(false); }
  }, [reload]);

  const handleBulkToggle = useCallback(async (flag: 'printable' | 'promoted', value: boolean) => {
    if (!bulkCycleId) return;
    setToggling(true);
    try { await apiClient.patch(`/enrollments/course/${bulkCycleId}/flags`, { flag, value }); reload(); }
    catch { /* silently fail */ }
    finally { setToggling(false); }
  }, [bulkCycleId, reload]);

  useEffect(() => {
    apiClient.get('/institutions').then(r => {
      const list = r.data?.data ?? [];
      setInstitutions(list);
      if (isRoot && !filters.institutionId && list.length > 0) {
        setFilters(prev => ({ ...prev, institutionId: list[0].id }));
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only init: fetch institutions + default for ROOT; isRoot/filters are session-stable
  }, []);

  const handleCreate = async () => {
    const ok = await create({ ...form, grade: form.grade || undefined, division: form.division || undefined });
    if (ok) { setShowForm(false); reload(); }
  };

  return (
    <div>
      <PremiumHeader
        title="Inscripciones"
        icon="📝"
        stats={[{ label: 'inscripciones', value: String(data.length) }]}
      >
        <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nueva inscripción'}</Button>
      </PremiumHeader>

      <div className="flex gap-md items-center" style={{ marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <Input label="Estudiante ID" value={filters.studentId} onChange={e => setFilters({...filters, studentId: e.target.value})} placeholder="Buscar por estudiante" />
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Institución</label>
          {isRoot ? (
            <select
              value={filters.institutionId}
              onChange={e => setFilters({...filters, institutionId: e.target.value})}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            >
              <option value="">Todas</option>
              {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={institutions.find(i => i.id === filters.institutionId)?.name || config.name || filters.institutionId}
              disabled
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            />
          )}
        </div>
        <Button variant="ghost" onClick={reload} style={{ marginTop: '1.25rem' }}>Buscar</Button>
      </div>

      {showForm && (
        <Card title="Nueva inscripción" className="mt-md">
          {createError && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{createError}</div>}
          <div className="flex flex-col gap-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input label="Estudiante ID" value={form.studentId} onChange={e => setForm({...form, studentId: e.target.value})} required />
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Institución</label>
                {isRoot ? (
                  <select
                    value={form.institutionId}
                    onChange={e => setForm({...form, institutionId: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}
                  >
                    <option value="">Seleccionar</option>
                    {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={institutions.find(i => i.id === form.institutionId)?.name || config.name || form.institutionId}
                    disabled
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)' }}
                  />
                )}
              </div>
            </div>
            <div className="field"><label className="field-label">Nivel</label><select className="input" value={form.level} onChange={e => setForm({...form, level: e.target.value})}>{['INICIAL','PRIMARIO','SECUNDARIO','TERCIARIO'].map(l => <option key={l} value={l}>{l}</option>)}</select></div>
            <Input label="Año lectivo" value={form.academicYear} onChange={e => setForm({...form, academicYear: e.target.value})} required />
            <Input label="Grado" value={form.grade} onChange={e => setForm({...form, grade: e.target.value})} />
            <Input label="División" value={form.division} onChange={e => setForm({...form, division: e.target.value})} />
            <Button variant="success-soft" onClick={handleCreate} loading={creating}>Inscribir</Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'level', header: 'Nivel' },
            { key: 'academicYear', header: 'Año' },
            { key: 'grade', header: 'Grado' },
            { key: 'division', header: 'Div' },
            { key: 'institutionName', header: 'Institución', render: (e: Record<string, unknown>) => {
              const iid = e.institutionId as string;
              if (!iid) return '-';
              return institutions.find(i => i.id === iid)?.name || iid;
            }},
            { key: 'status', header: 'Estado' },
            { key: 'printable', header: 'Imprime', render: (e: Record<string, unknown>) => (
              <span
                onClick={(ev) => { ev.stopPropagation(); handleToggleFlag(e.id as string, 'printable'); }}
                style={{ cursor: 'pointer', userSelect: 'none', fontSize: '1.25rem', opacity: toggling ? 0.5 : 1 }}
                title="Click para alternar"
              >
                {e.printable ? '✓' : '✕'}
              </span>
            )},
            { key: 'promoted', header: 'Promueve', render: (e: Record<string, unknown>) => (
              <span
                onClick={(ev) => { ev.stopPropagation(); handleToggleFlag(e.id as string, 'promoted'); }}
                style={{ cursor: 'pointer', userSelect: 'none', fontSize: '1.25rem', opacity: toggling ? 0.5 : 1 }}
                title="Click para alternar"
              >
                {e.promoted ? '✓' : '✕'}
              </span>
            )},
            { key: 'actions', header: '', render: (e) => (
              <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                <Button
                  variant="action"
                  size="sm"
                  disabled={!e.printable}
                  onClick={() => downloadBoletin(e.id as string)}
                  title={e.printable ? 'Descargar boletín en PDF' : 'Esta inscripción no es imprimible'}
                >
                  📄 Boletín
                </Button>
                <Button variant="danger-soft" size="sm" onClick={() => del(e.id as string).then(() => reload())} loading={deleting}>Eliminar</Button>
              </div>
            ) }
          ]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay inscripciones'}
        />
      </Card>

      <Card title="Acciones masivas" className="mt-md">
        <div className="flex gap-md items-center" style={{ flexWrap: 'wrap' }}>
          <Input label="ID del ciclo" value={bulkCycleId} onChange={e => setBulkCycleId(e.target.value)} placeholder="Ej: abc-123" />
          <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'flex-end', paddingTop: '1.25rem' }}>
            <Button variant="success-soft" size="sm" onClick={() => handleBulkToggle('printable', true)} loading={toggling}>Marcar todos imprimible</Button>
            <Button variant="danger-soft" size="sm" onClick={() => handleBulkToggle('printable', false)} loading={toggling}>Desmarcar todos imprimible</Button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-xs)', alignItems: 'flex-end', paddingTop: '1.25rem' }}>
            <Button variant="success-soft" size="sm" onClick={() => handleBulkToggle('promoted', true)} loading={toggling}>Marcar todos promueve</Button>
            <Button variant="danger-soft" size="sm" onClick={() => handleBulkToggle('promoted', false)} loading={toggling}>Desmarcar todos promueve</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
