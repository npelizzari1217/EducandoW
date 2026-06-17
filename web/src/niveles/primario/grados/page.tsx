import { useState } from 'react';
import { useApiList, useApiCreate, useApiDelete } from '../../../hooks/use-api';
import PremiumHeader from '../../../components/ui/premium-header';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { GradoForm } from './grado-form';

interface Grado {
  id: string;
  grade: number;
  division: string;
  academicYear: string;
  courseSectionId?: string;
  active: boolean;
}

export default function GradosPage() {
  const [academicYearFilter, setAcademicYearFilter] = useState('');
  const params = academicYearFilter ? { academicYear: academicYearFilter } : undefined;
  const { data, loading, reload } = useApiList<Grado>('/primario/grados', params);
  const { deleting, del } = useApiDelete('/primario/grados');
  const { creating, createError, create } = useApiCreate('/primario/grados');
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (formData: {
    grade: number;
    division: string;
    academicYear: string;
    courseSectionId: string;
  }) => {
    const payload = {
      grade: formData.grade,
      division: formData.division,
      academicYear: formData.academicYear,
      ...(formData.courseSectionId ? { courseSectionId: formData.courseSectionId } : {}),
    };
    const ok = await create(payload);
    if (ok) {
      setShowForm(false);
      reload();
    }
  };

  return (
    <div>
      <PremiumHeader
        title="Grados — Primario"
        icon="🏫"
        stats={[{ label: 'grados', value: String(data.length) }]}
      >
        <Button
          variant={showForm ? 'danger-soft' : 'success-soft'}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : 'Nuevo grado'}
        </Button>
      </PremiumHeader>

      <div className="flex gap-md items-center" style={{ marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <Input
          label="Filtrar por año lectivo"
          value={academicYearFilter}
          onChange={e => setAcademicYearFilter(e.target.value)}
          placeholder="Ej: 2026"
        />
        <Button variant="ghost" onClick={reload} style={{ marginTop: '1.25rem' }}>Buscar</Button>
      </div>

      {showForm && (
        <GradoForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          loading={creating}
          error={createError}
        />
      )}

      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'grade', header: 'Grado', render: (g: Record<string, unknown>) => `${g.grade}°` },
            { key: 'division', header: 'División' },
            { key: 'academicYear', header: 'Año lectivo' },
            { key: 'active', header: 'Estado', render: (g: Record<string, unknown>) => (g.active ? '✅ Activo' : '❌ Inactivo') },
            {
              key: 'actions',
              header: '',
              render: (g: Record<string, unknown>) => (
                <Button
                  variant="danger-soft"
                  size="sm"
                  onClick={() => del(g.id as string).then(() => reload())}
                  loading={deleting}
                >
                  Eliminar
                </Button>
              ),
            },
          ]}
          data={data as unknown as Record<string, unknown>[]}
          emptyMessage={loading ? 'Cargando...' : 'No hay grados registrados'}
        />
      </Card>
    </div>
  );
}
