import { useState } from 'react';
import { useApiList, useApiCreate } from '../../../hooks/use-api';
import PremiumHeader from '../../../components/ui/premium-header';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { MesaExamenForm } from './mesa-examen-form';
import { InscripcionDialog } from './inscripcion-dialog';

interface MesaExamen extends Record<string, unknown> {
  id: string;
  subjectId: string;
  fecha: string;
  turno: string;
  presidenteId: string;
  active: boolean;
  totalInscriptos: number;
}

interface MesaExamenFormValues {
  subjectId: string;
  fecha: string;
  turno: string;
  presidenteId: string;
}

export default function MesasExamenPage() {
  const { data, loading, reload } = useApiList<MesaExamen>('/secundario/mesas-examen');
  const { creating, createError, create } = useApiCreate<Record<string, unknown>>('/secundario/mesas-examen');
  const [showForm, setShowForm] = useState(false);
  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null);

  const handleCreate = async (values: MesaExamenFormValues) => {
    const ok = await create({
      subjectId: values.subjectId,
      fecha: new Date(values.fecha).toISOString(),
      turno: values.turno,
      presidenteId: values.presidenteId,
    });
    if (ok) {
      setShowForm(false);
      reload();
    }
  };

  return (
    <div>
      <PremiumHeader
        title="Mesas de Examen — Secundario"
        icon="📋"
        stats={[{ label: 'mesas', value: String(data.length) }]}
      >
        <Button
          variant={showForm ? 'danger-soft' : 'success-soft'}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : 'Nueva mesa'}
        </Button>
      </PremiumHeader>

      {showForm && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <MesaExamenForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            loading={creating}
            error={createError}
          />
        </div>
      )}

      <Card className="mt-lg">
        <Table<MesaExamen>
          columns={[
            { key: 'turno', header: 'Turno' },
            { key: 'fecha', header: 'Fecha', render: (m) => new Date(m.fecha).toLocaleDateString('es-AR') },
            { key: 'subjectId', header: 'Materia (ID)', render: (m) => m.subjectId.slice(0, 8) + '...' },
            { key: 'totalInscriptos', header: 'Inscriptos' },
            {
              key: 'actions',
              header: '',
              render: (m) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMesaId(m.id)}
                >
                  Inscribir alumno
                </Button>
              ),
            },
          ]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay mesas de examen'}
        />
      </Card>

      {selectedMesaId && (
        <InscripcionDialog
          mesaId={selectedMesaId}
          onClose={() => setSelectedMesaId(null)}
          onSuccess={() => reload()}
        />
      )}
    </div>
  );
}
