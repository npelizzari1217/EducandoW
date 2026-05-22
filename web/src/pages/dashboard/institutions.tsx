import { useState } from 'react';
import { useAuth } from '../../context/auth-context';
import { useApiList, useApiDelete, useApiCreate } from '../../hooks/use-api';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

export default function InstitutionsPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useApiList<{ id: string; name: string; levels: string[] }>('/institutions');
  const { deleting, del } = useApiDelete('/institutions');
  const { creating, createError, create, setCreateError } = useApiCreate('/institutions');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', levels: ['INICIAL'] as string[] });

  const handleCreate = async () => {
    const ok = await create({ name: form.name, address: form.address || undefined, phone: form.phone || undefined, email: form.email || undefined, levels: form.levels });
    if (ok) { setShowForm(false); setForm({ name: '', address: '', phone: '', email: '', levels: ['INICIAL'] }); reload(); }
  };

  const toggleLevel = (l: string) => setForm(f => ({ ...f, levels: f.levels.includes(l) ? f.levels.filter(x => x !== l) : [...f.levels, l] }));

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Instituciones</h1><p className="page-subtitle">Gestioná las instituciones educativas</p></div>
        {user?.role === 'ADMIN' && <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nueva institución'}</Button>}
      </div>

      {showForm && (
        <Card title="Nueva institución" className="mt-md">
          {createError && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{createError}</div>}
          <div className="flex flex-col gap-md">
            <Input label="Nombre" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            <Input label="Dirección" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            <Input label="Teléfono" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <div className="field"><label className="field-label">Niveles</label>
              <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                {['INICIAL','PRIMARIO','SECUNDARIO','TERCIARIO'].map(l => (
                  <label key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.levels.includes(l)} onChange={() => toggleLevel(l)} />{l}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} loading={creating}>Crear institución</Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[{ key: 'name', header: 'Nombre' }, { key: 'levels', header: 'Niveles', render: (i) => i.levels?.join(', ') }, { key: 'actions', header: '', render: (i) => user?.role === 'ADMIN' ? <Button variant="ghost" size="sm" onClick={() => del(i.id).then(() => reload())} loading={deleting}>Eliminar</Button> : null }]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay instituciones'}
        />
      </Card>
    </div>
  );
}
