import { useState } from 'react';
import { useApiList, useApiCreate } from '../../../hooks/use-api';
import PremiumHeader from '../../../components/ui/premium-header';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { CalificacionForm } from './calificacion-form';

interface Calificacion {
  id: string;
  studentId: string;
  gradoId: string;
  subjectId: string;
  trimestre: string;
  nota: number;
  concepto: string;
  aprobado: boolean;
}

export default function CalificacionesPage() {
  const [filters, setFilters] = useState({ gradoId: '', studentId: '' });
  const params: Record<string, string> = {};
  if (filters.gradoId) params.gradoId = filters.gradoId;
  if (filters.studentId) params.studentId = filters.studentId;

  const { data, loading, reload } = useApiList<Calificacion>('/primario/calificaciones', Object.keys(params).length > 0 ? params : undefined);
  const { creating, createError, create } = useApiCreate('/primario/calificaciones');
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (formData: {
    studentId: string;
    gradoId: string;
    subjectId: string;
    trimestre: string;
    nota: number;
    concepto: string;
    aprobado: boolean;
  }) => {
    const ok = await create(formData);
    if (ok) {
      setShowForm(false);
      reload();
    }
  };

  return (
    <div>
      <PremiumHeader
        title="Calificaciones — Primario"
        icon="📊"
        stats={[{ label: 'calificaciones', value: String(data.length) }]}
      >
        <Button
          variant={showForm ? 'danger-soft' : 'success-soft'}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : 'Nueva calificación'}
        </Button>
      </PremiumHeader>

      <div className="flex gap-md items-center" style={{ marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <Input
          label="Grado ID"
          value={filters.gradoId}
          onChange={e => setFilters({ ...filters, gradoId: e.target.value })}
          placeholder="Filtrar por grado"
        />
        <Input
          label="Estudiante ID"
          value={filters.studentId}
          onChange={e => setFilters({ ...filters, studentId: e.target.value })}
          placeholder="Filtrar por estudiante"
        />
        <Button variant="ghost" onClick={reload} style={{ marginTop: '1.25rem' }}>Buscar</Button>
      </div>

      {showForm && (
        <CalificacionForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          loading={creating}
          error={createError}
        />
      )}

      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'studentId', header: 'Estudiante' },
            { key: 'gradoId', header: 'Grado' },
            { key: 'subjectId', header: 'Materia' },
            { key: 'trimestre', header: 'Trimestre' },
            { key: 'nota', header: 'Nota', render: (c: Record<string, unknown>) => String(c.nota) },
            { key: 'concepto', header: 'Concepto' },
            { key: 'aprobado', header: 'Estado', render: (c: Record<string, unknown>) => (c.aprobado ? '✅ Aprobado' : '❌ Reprobado') },
          ]}
          data={data as unknown as Record<string, unknown>[]}
          emptyMessage={loading ? 'Cargando...' : 'No hay calificaciones registradas'}
        />
      </Card>
    </div>
  );
}
