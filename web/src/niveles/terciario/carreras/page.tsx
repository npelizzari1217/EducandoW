import { useState, useEffect, useCallback } from 'react';
import PremiumHeader from '../../../components/ui/premium-header';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import apiClient from '../../../api/client';
import { CarreraForm } from './carrera-form';

interface Carrera {
  [key: string]: unknown;
  id: string;
  name: string;
  titulo: string;
  duracion: number;
  resolucion?: string;
  active: boolean;
}

export default function CarrerasPage() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Carrera | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/terciario/carreras');
      setCarreras(res.data?.data ?? []);
    } catch {
      setError('No se pudieron cargar las carreras.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (values: { name: string; titulo: string; duracion: number; resolucion?: string }) => {
    setSaving(true);
    try {
      await apiClient.post('/terciario/carreras', values);
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (values: { name: string; titulo: string; duracion: number; resolucion?: string }) => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiClient.patch(`/terciario/carreras/${editing.id}`, values);
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta carrera?')) return;
    try {
      await apiClient.delete(`/terciario/carreras/${id}`);
      await load();
    } catch {
      setError('No se pudo eliminar la carrera.');
    }
  };

  return (
    <div>
      <PremiumHeader
        title="Carreras Terciarias"
        subtitle="Gestión de carreras del nivel terciario"
        icon="🎓"
      >
        {!showForm && !editing && (
          <Button variant="action" onClick={() => setShowForm(true)}>+ Nueva carrera</Button>
        )}
      </PremiumHeader>

      {(showForm || editing) && (
        <Card title={editing ? 'Editar carrera' : 'Nueva carrera'} className="mt-md">
          <CarreraForm
            initial={editing ?? undefined}
            onSubmit={editing ? handleUpdate : handleCreate}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            loading={saving}
          />
        </Card>
      )}

      <Card className="mt-md">
        {loading && <p style={{ padding: 'var(--space-md)', textAlign: 'center' }}>Cargando...</p>}
        {error && <p style={{ color: 'var(--color-danger)', padding: 'var(--space-md)' }}>{error}</p>}
        {!loading && (
          <Table
            columns={[
              { key: 'name', header: 'Carrera' },
              { key: 'titulo', header: 'Título que otorga' },
              { key: 'duracion', header: 'Duración', render: (c: Carrera) => `${c.duracion} año${c.duracion !== 1 ? 's' : ''}` },
              { key: 'resolucion', header: 'Resolución', render: (c: Carrera) => c.resolucion || '-' },
              {
                key: 'actions', header: '',
                render: (c: Carrera) => (
                  <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <Button variant="action" size="sm" onClick={() => setEditing(c)}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>Eliminar</Button>
                  </div>
                ),
              },
            ]}
            data={carreras}
            emptyMessage="No hay carreras registradas"
          />
        )}
      </Card>
    </div>
  );
}
