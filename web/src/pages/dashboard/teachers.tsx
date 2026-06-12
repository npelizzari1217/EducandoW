import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiDelete, useApiCreate, useApiUpdate } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import apiClient from '../../api/client';

interface Institution { id: string; name: string; }

export default function TeachersPage() {
  const { user } = useAuth();
  const { config } = useInstitution();
  const isRoot = user?.roles?.includes('ROOT');
  const userInstitutionId = user?.institutionId ?? config.id ?? '';

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState(userInstitutionId);
  const { data, loading, reload } = useApiList<{ id: string; firstName: string; lastName: string; dni: string; email: string; fullName: string; active: boolean }>('/teachers', institutionId ? { institutionId } : undefined);
  const { deleting, del } = useApiDelete('/teachers');
  const { creating, createError, create } = useApiCreate('/teachers', institutionId ? { institutionId } : undefined);
  const { updating, updateError, update } = useApiUpdate('/teachers', institutionId ? { institutionId } : undefined);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', dni: '', email: '', phone: '', title: '', password: '', active: true, institutionId });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/institutions').then(r => {
      const list = r.data?.data ?? [];
      setInstitutions(list);
      if (isRoot && !institutionId && list.length > 0) {
        setInstitutionId(list[0].id);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only init: fetch institutions + default for ROOT; isRoot/institutionId are session-stable
  }, []);

  const handleCreate = async () => {
    setFormError(null);
    if (!form.dni.trim()) { setFormError('El DNI es requerido'); return; }
    if (!form.lastName.trim()) { setFormError('El apellido es requerido'); return; }
    if (!form.firstName.trim()) { setFormError('El nombre es requerido'); return; }
    const ok = await create({ ...form, phone: form.phone || undefined, title: form.title || undefined, password: form.password || undefined, institutionId });
    if (ok) { setShowForm(false); setForm({ firstName: '', lastName: '', dni: '', email: '', phone: '', title: '', password: '', active: true, institutionId }); reload(); }
  };

  const handleEdit = (teacher: { id: string; firstName: string; lastName: string; dni: string; email: string; fullName: string; phone?: string; title?: string; active?: boolean }) => {
    setEditingId(teacher.id);
    setFormError(null);
    setForm({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      dni: teacher.dni,
      email: teacher.email,
      phone: (teacher as Record<string, unknown>).phone as string ?? '',
      title: (teacher as Record<string, unknown>).title as string ?? '',
      password: '',
      active: (teacher as Record<string, unknown>).active as boolean ?? true,
      institutionId,
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setFormError(null);
    if (!form.dni.trim()) { setFormError('El DNI es requerido'); return; }
    if (!form.lastName.trim()) { setFormError('El apellido es requerido'); return; }
    if (!form.firstName.trim()) { setFormError('El nombre es requerido'); return; }
    const ok = await update(editingId, {
      firstName: form.firstName,
      lastName: form.lastName,
      dni: form.dni,
      email: form.email,
      phone: form.phone || undefined,
      title: form.title || undefined,
      active: form.active,
    });
    if (ok) { setEditingId(null); reload(); }
  };

  return (
    <div>
      <PremiumHeader
        title="Docentes"
        subtitle="Gestión de docentes"
        icon="👨‍🏫"
        stats={[{ label: 'docentes', value: String(data.length) }]}
      >
        <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nuevo docente'}</Button>
      </PremiumHeader>

      <div className="flex gap-md items-center" style={{ marginBottom: 'var(--space-md)' }}>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Filtrar por institución</label>
          {isRoot ? (
            <select
              className="input"
              value={institutionId}
              onChange={e => setInstitutionId(e.target.value)}
            >
              {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={institutions.find(i => i.id === institutionId)?.name || institutionId}
              disabled
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            />
          )}
        </div>
        <Button variant="ghost" onClick={reload} style={{ marginTop: '1.25rem' }}>Buscar</Button>
      </div>

      {showForm && (
        <Card title="Nuevo docente" className="mt-md">
          {(formError || createError) && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{formError || createError}</div>}
          <div className="flex flex-col gap-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input label="Nombre" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value.toUpperCase()})} required />
              <Input label="Apellido" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value.toUpperCase()})} required />
            </div>
            <Input label="DNI" value={form.dni} onChange={e => setForm({...form, dni: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})} required />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
            <Input label="Contraseña" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            <Input label="Teléfono" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <Input label="Título" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} />
              Activo
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <Button variant="success-soft" onClick={handleCreate} loading={creating}>Crear docente</Button>
              <Button variant="danger-soft" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
        </Card>
      )}

      {editingId && (
        <Card title="Editar docente" className="mt-md">
          {(formError || updateError) && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{formError || updateError}</div>}
          <div className="flex flex-col gap-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input label="Nombre" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value.toUpperCase()})} required />
              <Input label="Apellido" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value.toUpperCase()})} required />
            </div>
            <Input label="DNI" value={form.dni} onChange={e => setForm({...form, dni: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})} required />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
            <Input label="Teléfono" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            <Input label="Título" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} />
              Activo
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <Button variant="success-soft" onClick={handleUpdate} loading={updating}>Guardar cambios</Button>
              <Button variant="danger-soft" onClick={() => setEditingId(null)}>Cancelar</Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[{ key: 'fullName', header: 'Nombre' }, { key: 'dni', header: 'DNI' }, { key: 'email', header: 'Email' }, { key: 'actions', header: '', render: (t) => <div style={{ display: 'flex', gap: 'var(--space-xs)' }}><Button variant="action" size="sm" onClick={() => handleEdit(t)}>Editar</Button><Button variant="danger-soft" size="sm" onClick={() => del(t.id).then(() => reload())} loading={deleting}>Eliminar</Button></div> }]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay docentes'}
        />
      </Card>
    </div>
  );
}
