import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiDelete, useApiCreate } from '../../hooks/use-api';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import apiClient from '../../api/client';

interface Institution { id: string; name: string; }

export default function StudentsPage() {
  const { user } = useAuth();
  const { config } = useInstitution();
  const isRoot = (user as any)?.roles?.includes('ROOT');
  const userInstitutionId = user?.institutionId ?? config.id ?? '';

  const [institutionId, setInstitutionId] = useState(userInstitutionId);
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  useEffect(() => {
    apiClient.get('/institutions').then(r => {
      setInstitutions(r.data?.data ?? []);
    }).catch(() => {});
  }, []);

  const { data, loading, reload } = useApiList<{ id: string; firstName: string; lastName: string; dni: string; fullName: string }>('/students', institutionId ? { institutionId } : undefined);
  const { deleting, del } = useApiDelete('/students');
  const { creating, createError, create, setCreateError } = useApiCreate('/students');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', dni: '', email: '', birthDate: '', guardianName: '', guardianPhone: '', institutionId: institutionId });

  const handleCreate = async () => {
    const ok = await create({ ...form, birthDate: form.birthDate || undefined, guardianName: form.guardianName || undefined, guardianPhone: form.guardianPhone || undefined, email: form.email || undefined, institutionId: institutionId });
    if (ok) { setShowForm(false); reload(); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Estudiantes</h1><p className="page-subtitle">Gestión de alumnos</p></div>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nuevo estudiante'}</Button>
      </div>

      <div className="flex gap-md items-center" style={{ marginBottom: 'var(--space-md)' }}>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Institución</label>
          {isRoot ? (
            <select
              value={institutionId}
              onChange={e => setInstitutionId(e.target.value)}
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
              value={institutions.find(i => i.id === institutionId)?.name || config.name || institutionId}
              disabled
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            />
          )}
        </div>
        <Button variant="ghost" onClick={reload} style={{ marginTop: '1.25rem' }}>Buscar</Button>
      </div>

      {showForm && (
        <Card title="Nuevo estudiante" className="mt-md">
          {createError && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{createError}</div>}
          <div className="flex flex-col gap-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input label="Nombre" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required />
              <Input label="Apellido" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required />
            </div>
            <Input label="DNI" value={form.dni} onChange={e => setForm({...form, dni: e.target.value})} required />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <Input label="Fecha de nacimiento" type="date" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} />
            <Input label="Nombre del tutor" value={form.guardianName} onChange={e => setForm({...form, guardianName: e.target.value})} />
            <Input label="Teléfono del tutor" value={form.guardianPhone} onChange={e => setForm({...form, guardianPhone: e.target.value})} />
            <Button onClick={handleCreate} loading={creating}>Crear estudiante</Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[{ key: 'fullName', header: 'Nombre' }, { key: 'dni', header: 'DNI' }, { key: 'actions', header: '', render: (s) => <Button variant="ghost" size="sm" onClick={() => del(s.id).then(() => reload())} loading={deleting}>Eliminar</Button> }]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay estudiantes'}
        />
      </Card>
    </div>
  );
}
