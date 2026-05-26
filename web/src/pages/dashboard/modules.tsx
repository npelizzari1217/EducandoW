import { useState } from 'react';
import { useApiList, useApiDelete, useApiCreate, useApiUpdate } from '../../hooks/use-api';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

interface Module {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ModulesPage() {
  const { data, loading, reload } = useApiList<Module>('/modules');
  const { deleting, del } = useApiDelete('/modules');
  const { creating, createError, create, setCreateError } = useApiCreate('/modules');
  const { updating, updateError, update, setUpdateError } = useApiUpdate('/modules');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', active: true });

  const resetForm = () => {
    setForm({ code: '', name: '', active: true });
    setEditingId(null);
    setShowForm(false);
    setCreateError('');
    setUpdateError('');
  };

  const handleCreate = async () => {
    const ok = await create({ code: form.code, name: form.name });
    if (ok) { resetForm(); reload(); }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const ok = await update(editingId, { code: form.code, name: form.name, active: form.active });
    if (ok) { resetForm(); reload(); }
  };

  const startEdit = (m: Module) => {
    setEditingId(m.id);
    setForm({ code: m.code, name: m.name, active: m.active });
    setShowForm(true);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Módulos del Sistema</h1>
          <p className="page-subtitle">Gestión de módulos — solo ROOT</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <Button variant="action" onClick={handlePrint} title="Imprimir">🖨 Imprimir</Button>
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
            {showForm ? 'Cancelar' : 'Nuevo módulo'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card title={editingId ? 'Editar módulo' : 'Nuevo módulo'} className="mt-md">
          {(createError || updateError) && (
            <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
              {createError || updateError}
            </div>
          )}
          <div className="flex flex-col gap-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-md)' }}>
              <Input label="Código" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Ej: USERS, GRADES" required disabled={!!editingId} />
              <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Gestión de Usuarios" required />
            </div>
            {editingId && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                Activo
              </label>
            )}
            <Button onClick={editingId ? handleUpdate : handleCreate} loading={creating || updating}>
              {editingId ? 'Guardar cambios' : 'Crear módulo'}
            </Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg print-friendly">
        <Table
          columns={[
            { key: 'code', header: 'Código' },
            { key: 'name', header: 'Nombre' },
            { key: 'active', header: 'Activo', render: (m: any) => m.active ? '✅' : '❌' },
            {
              key: 'actions', header: '',
              render: (m: any) => (
                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                  <Button variant="action" size="sm" onClick={() => startEdit(m as unknown as Module)}>Editar</Button>
                  <Button variant="action" size="sm" onClick={() => del((m as unknown as Module).id).then(() => reload())} loading={deleting}>Eliminar</Button>
                </div>
              ),
            },
          ]}
          data={data as any}
          emptyMessage={loading ? 'Cargando...' : 'No hay módulos registrados'}
        />
      </Card>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-friendly, .print-friendly * { visibility: visible; }
          .print-friendly { position: absolute; left: 0; top: 0; width: 100%; }
          .page-header { visibility: visible; position: absolute; left: 0; top: 0; }
        }
      `}</style>
    </div>
  );
}
