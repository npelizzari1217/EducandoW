import { useState } from 'react';
import { useAuth } from '../../context/auth-context';
import { useApiList, useApiDelete, useApiCreate } from '../../hooks/use-api';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

export default function TeachersPage() {
  const { user } = useAuth();
  const [institutionId, setInstitutionId] = useState(user?.institutionId ?? '');
  const { data, loading, reload } = useApiList<{ id: string; firstName: string; lastName: string; dni: string; email: string; fullName: string }>('/teachers', institutionId ? { institutionId } : undefined);
  const { deleting, del } = useApiDelete('/teachers');
  const { creating, createError, create } = useApiCreate('/teachers');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', dni: '', email: '', phone: '', title: '', institutionId });

  const handleCreate = async () => {
    const ok = await create({ ...form, phone: form.phone || undefined, title: form.title || undefined, institutionId });
    if (ok) { setShowForm(false); reload(); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Docentes</h1><p className="page-subtitle">Gestión de docentes</p></div>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nuevo docente'}</Button>
      </div>

      <div className="flex gap-md items-center" style={{ marginBottom: 'var(--space-md)' }}>
        <Input label="Filtrar por institución" value={institutionId} onChange={e => setInstitutionId(e.target.value)} placeholder="UUID" />
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
            <Button onClick={handleCreate} loading={creating}>Crear docente</Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[{ key: 'fullName', header: 'Nombre' }, { key: 'dni', header: 'DNI' }, { key: 'email', header: 'Email' }, { key: 'actions', header: '', render: (t) => <Button variant="ghost" size="sm" onClick={() => del(t.id).then(() => reload())} loading={deleting}>Eliminar</Button> }]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay docentes'}
        />
      </Card>
    </div>
  );
}
