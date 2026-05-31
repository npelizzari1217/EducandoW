import { useState } from 'react';
import { useApiList } from '../../../hooks/use-api';
import PremiumHeader from '../../../components/ui/premium-header';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import InformeForm from './informe-form';

interface Informe {
  id: string;
  studentId: string;
  salaId: string;
  periodo: string;
  fecha: string;
  observacionesGenerales?: string;
  areas: Array<{ id: string; informeId: string; area: string; observacion: string; valoracion: string }>;
}

export default function InformesPage() {
  const { data: informes, reload } = useApiList<Informe>('/v1/inicial/informes');
  const [showForm, setShowForm] = useState(false);
  const [editingInforme, setEditingInforme] = useState<Informe | null>(null);

  const handleSaved = () => {
    setShowForm(false);
    setEditingInforme(null);
    reload();
  };

  const handleEdit = (informe: Informe) => {
    setEditingInforme(informe);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingInforme(null);
  };

  return (
    <div>
      <PremiumHeader
        title="Informes Evolutivos"
        subtitle="Seguimiento del desarrollo de los alumnos"
        icon="📋"
        stats={[{ label: 'informes', value: String(informes.length) }]}
      >
        <Button
          variant={showForm ? 'danger-soft' : 'success-soft'}
          onClick={() => { setEditingInforme(null); setShowForm(!showForm); }}
        >
          {showForm ? 'Cancelar' : 'Nuevo informe'}
        </Button>
      </PremiumHeader>

      {showForm && (
        <Card title={editingInforme ? 'Editar informe' : 'Nuevo informe evolutivo'} className="mt-md">
          <InformeForm
            initial={editingInforme ?? undefined}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'studentId', header: 'Estudiante ID' },
            { key: 'salaId', header: 'Sala ID' },
            { key: 'periodo', header: 'Período' },
            {
              key: 'fecha',
              header: 'Fecha',
              render: (i) => new Date((i as unknown as Informe).fecha).toLocaleDateString('es-AR'),
            },
            {
              key: 'areas',
              header: 'Áreas',
              render: (i) => `${((i as unknown as Informe).areas ?? []).length} área(s)`,
            },
            {
              key: 'actions',
              header: '',
              render: (i) => (
                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                  <Button variant="action" size="sm" onClick={() => handleEdit(i as unknown as Informe)}>Editar</Button>
                </div>
              ),
            },
          ]}
          data={informes as unknown as Record<string, unknown>[]}
          emptyMessage="No hay informes registrados"
        />
      </Card>
    </div>
  );
}
