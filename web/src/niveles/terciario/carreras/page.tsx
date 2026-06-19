import { useState, useEffect, useCallback } from 'react';
import PremiumHeader from '../../../components/ui/premium-header';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import apiClient from '../../../api/client';
import { useAuth } from '../../../context/auth-context';
import { useInstitution } from '../../../context/institution-context';
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
  const { user } = useAuth();
  const { config } = useInstitution();
  const myRoles: string[] = user?.roles ?? (user?.role ? [user.role] : []);
  const isRoot = myRoles.includes('ROOT');

  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Carrera | null>(null);
  const [saving, setSaving] = useState(false);
  const [institutionId, setInstitutionId] = useState(user?.institutionId ?? config.id ?? '');
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);

  // Las rutas de terciario son de tenant: el back exige institutionId por query param.
  const params = institutionId ? { institutionId } : undefined;

  useEffect(() => {
    if (!isRoot) return;
    apiClient.get('/institutions').then(r => {
      setInstitutions(r.data?.data ?? []);
    }).catch(() => {});
  }, [isRoot]);

  const load = useCallback(async () => {
    // ROOT debe elegir una institución concreta antes de listar (no hay "todas" en tenant).
    if (!institutionId) {
      setCarreras([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/terciario/carreras', { params });
      setCarreras(res.data?.data ?? []);
    } catch {
      setError('No se pudieron cargar las carreras.');
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (values: { name: string; titulo: string; duracion: number; resolucion?: string }) => {
    setSaving(true);
    try {
      await apiClient.post('/terciario/carreras', values, { params });
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
      await apiClient.patch(`/terciario/carreras/${editing.id}`, values, { params });
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta carrera?')) return;
    try {
      await apiClient.delete(`/terciario/carreras/${id}`, { params });
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
        {!showForm && !editing && (!isRoot || institutionId) && (
          <Button variant="action" onClick={() => setShowForm(true)}>+ Nueva carrera</Button>
        )}
      </PremiumHeader>

      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Institución</label>
          {isRoot ? (
            <select
              value={institutionId}
              onChange={e => setInstitutionId(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            >
              <option value="">Seleccioná una institución</option>
              {institutions.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={config.name || ''}
              disabled
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            />
          )}
        </div>
      </div>

      {isRoot && !institutionId && (
        <Card className="mt-md">
          <p style={{ padding: 'var(--space-md)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Seleccioná una institución para ver y gestionar sus carreras.
          </p>
        </Card>
      )}

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

      {(!isRoot || institutionId) && (
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
      )}
    </div>
  );
}
