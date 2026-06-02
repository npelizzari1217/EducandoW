import { useState } from 'react';
import { useApiList } from '../../../hooks/use-api';
import PremiumHeader from '../../../components/ui/premium-header';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import PlanificacionForm from './planificacion-form';

interface SecuenciaDidactica {
  id: string;
  planificacionId: string;
  nombre: string;
  area: string;
  actividades: string[];
  recursos: string[];
}

interface Planificacion {
  id: string;
  salaId: string;
  semana: number;
  academicYear: string;
  active: boolean;
  secuencias: SecuenciaDidactica[];
}

export default function PlanificacionesPage() {
  const { data: planificaciones, reload } = useApiList<Planificacion>('/inicial/planificaciones');
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Planificacion | null>(null);

  const handleSaved = () => {
    setShowForm(false);
    setEditingPlan(null);
    reload();
  };

  const handleEdit = (plan: Planificacion) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingPlan(null);
  };

  return (
    <div>
      <PremiumHeader
        title="Planificaciones"
        subtitle="Planificaciones semanales por sala"
        icon="📅"
        stats={[{ label: 'planificaciones', value: String(planificaciones.length) }]}
      >
        <Button
          variant={showForm ? 'danger-soft' : 'success-soft'}
          onClick={() => { setEditingPlan(null); setShowForm(!showForm); }}
        >
          {showForm ? 'Cancelar' : 'Nueva planificación'}
        </Button>
      </PremiumHeader>

      {showForm && (
        <Card title={editingPlan ? 'Editar planificación' : 'Nueva planificación'} className="mt-md">
          <PlanificacionForm
            initial={editingPlan ?? undefined}
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'salaId', header: 'Sala ID' },
            { key: 'semana', header: 'Semana', render: (p) => `Semana ${(p as unknown as Planificacion).semana}` },
            { key: 'academicYear', header: 'Año' },
            {
              key: 'secuencias',
              header: 'Secuencias',
              render: (p) => `${((p as unknown as Planificacion).secuencias ?? []).length} secuencia(s)`,
            },
            {
              key: 'actions',
              header: '',
              render: (p) => (
                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                  <Button variant="action" size="sm" onClick={() => handleEdit(p as unknown as Planificacion)}>Editar</Button>
                </div>
              ),
            },
          ]}
          data={planificaciones as unknown as Record<string, unknown>[]}
          emptyMessage="No hay planificaciones registradas"
        />
      </Card>
    </div>
  );
}
