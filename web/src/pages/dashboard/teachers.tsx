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

export default function TeachersPage() {
  const { user } = useAuth();
  const { config } = useInstitution();
  const isRoot = (user as any)?.roles?.includes('ROOT');
  const userInstitutionId = user?.institutionId ?? config.id ?? '';

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState(userInstitutionId);
  const { data, loading, reload } = useApiList<{ id: string; firstName: string; lastName: string; dni: string; email: string; fullName: string }>('/teachers', institutionId ? { institutionId } : undefined);
  const { deleting, del } = useApiDelete('/teachers');
  const { creating, createError, create } = useApiCreate('/teachers');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', dni: '', email: '', phone: '', title: '', institutionId });

  useEffect(() => {
    apiClient.get('/institutions').then(r => setInstitutions(r.data?.data ?? [])).catch(() => {});
  }, []);

  const handleCreate = async () => {
    const ok = await create({ ...form, phone: form.phone || undefined, title: form.title || undefined, institutionId });
    if (ok) { setShowForm(false); reload(); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Docentes</h1><p className="page-subtitle">Gestión de docentes</p></div>
        <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nuevo docente'}</Button>
      </div>

      <div className="flex gap-md items-center" style={{ marginBottom: 'var(--space-md)' }}>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Filtrar por institución</label>
          <select
            className="input"
            value={institutionId}
            onChange={e => setInstitutionId(e.target.value)}
            disabled={!isRoot}
          >
            <option value="">Todas</option>
            {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
          </select>
        </div>
        <Button variant="ghost" onClick={reload} style={{ marginTop: '1.25rem' }}>Buscar</Button>
      </div>

      {showForm && (
        <Card title="Nuevo docente" className="mt-md">
          {createError && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{createError}</div>}
          <div className="flex flex-col gap-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input label="Nombre" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required />
              <Input label="Apellido" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required />
            </div>
            <Input label="DNI" value={form.dni} onChange={e => setForm({...form, dni: e.target.value})} required />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
            <Input label="Teléfono" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <Input label="Título" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <Button variant="success-soft" onClick={handleCreate} loading={creating}>Crear docente</Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[{ key: 'fullName', header: 'Nombre' }, { key: 'dni', header: 'DNI' }, { key: 'email', header: 'Email' }, { key: 'actions', header: '', render: (t) => <Button variant="danger-soft" size="sm" onClick={() => del(t.id).then(() => reload())} loading={deleting}>Eliminar</Button> }]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay docentes'}
        />
      </Card>
    </div>
  );
}
