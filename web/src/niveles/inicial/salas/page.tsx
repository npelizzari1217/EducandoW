import { useState } from 'react';
import { useApiList, useApiDelete } from '../../../hooks/use-api';
import PremiumHeader from '../../../components/ui/premium-header';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import SalaForm from './sala-form';

interface Sala {
  id: string;
  name: string;
  ageGroup: number;
  turno: string;
  capacity: number;
  teacherId?: string;
  academicYear: string;
  active: boolean;
}

export default function SalasPage() {
  const { data: salas, reload } = useApiList<Sala>('/v1/inicial/salas');
  const { deleting, del } = useApiDelete('/v1/inicial/salas');
  const [showForm, setShowForm] = useState(false);
  const [editingSala, setEditingSala] = useState<Sala | null>(null);
  const [error, setError] = useState('');

  const handleSaved = () => {
    setShowForm(false);
    setEditingSala(null);
    reload();
  };

  const handleEdit = (sala: Sala) => {
    setEditingSala(sala);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    setError('');
    const ok = await del(id);
    if (ok) {
      reload();
    } else {
      setError('Error al eliminar la sala');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingSala(null);
  };

  return (
    <div>
      <PremiumHeader
        title="Salas"
        subtitle="Gestión de salas del nivel inicial"
        icon="🏫"
        stats={[{ label: 'salas', value: String(salas.length) }]}
      >
        <Button
          variant={showForm ? 'danger-soft' : 'success-soft'}
          onClick={() => { setEditingSala(null); setShowForm(!showForm); }}
        >
          {showForm ? 'Cancelar' : 'Nueva sala'}
        </Button>
      </PremiumHeader>

      {error && (
        <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
          {error}
        </div>
      )}

      {showForm && (
        <Card title={editingSala ? 'Editar sala' : 'Nueva sala'} className="mt-md">
          <SalaForm
            initial={editingSala ?? undefined}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'name', header: 'Nombre' },
            { key: 'ageGroup', header: 'Edad', render: (s) => `${(s as unknown as Sala).ageGroup} años` },
            { key: 'turno', header: 'Turno' },
            { key: 'capacity', header: 'Capacidad' },
            { key: 'academicYear', header: 'Año' },
            {
              key: 'actions',
              header: '',
              render: (s) => {
                const sala = s as unknown as Sala;
                return (
                  <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                    <Button variant="action" size="sm" onClick={() => handleEdit(sala)}>Editar</Button>
                    <Button variant="danger-soft" size="sm" onClick={() => handleDelete(sala.id)} loading={deleting}>Eliminar</Button>
                  </div>
                );
              },
            },
          ]}
          data={salas as unknown as Record<string, unknown>[]}
          emptyMessage="No hay salas registradas"
        />
      </Card>
    </div>
  );
}
