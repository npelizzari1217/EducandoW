import { useState } from 'react';
import { useApiList, useApiDelete, useApiCreate } from '../../../hooks/use-api';
import PremiumHeader from '../../../components/ui/premium-header';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { CursoForm } from './curso-form';

interface Curso extends Record<string, unknown> {
  id: string;
  year: number;
  division: string;
  orientacion?: string;
  academicYear: string;
  active: boolean;
}

export default function CursosPage() {
  const [academicYear] = useState(String(new Date().getFullYear()));
  const { data, loading, reload } = useApiList<Curso>('/v1/secundario/cursos', { academicYear });
  const { deleting, del } = useApiDelete('/v1/secundario/cursos');
  const { creating, createError, create } = useApiCreate<Record<string, unknown>>('/v1/secundario/cursos');
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async (values: { year: number; division: string; orientacion: string; academicYear: string }) => {
    const payload: Record<string, unknown> = {
      year: values.year,
      division: values.division,
      academicYear: values.academicYear,
    };
    if (values.orientacion) payload.orientacion = values.orientacion;

    const ok = await create(payload);
    if (ok) {
      setShowForm(false);
      reload();
    }
  };

  return (
    <div>
      <PremiumHeader
        title="Cursos — Secundario"
        icon="🏫"
        stats={[{ label: 'cursos', value: String(data.length) }]}
      >
        <Button
          variant={showForm ? 'danger-soft' : 'success-soft'}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : 'Nuevo curso'}
        </Button>
      </PremiumHeader>

      {showForm && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <CursoForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            loading={creating}
            error={createError}
          />
        </div>
      )}

      <Card className="mt-lg">
        <Table<Curso>
          columns={[
            { key: 'year', header: 'Año', render: (c) => `${c.year}°` },
            { key: 'division', header: 'División' },
            { key: 'orientacion', header: 'Orientación', render: (c) => c.orientacion ?? '—' },
            { key: 'academicYear', header: 'Año lectivo' },
            {
              key: 'actions',
              header: '',
              render: (c) => (
                <Button
                  variant="danger-soft"
                  size="sm"
                  loading={deleting}
                  onClick={() => del(c.id).then(() => reload())}
                >
                  Eliminar
                </Button>
              ),
            },
          ]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay cursos registrados'}
        />
      </Card>
    </div>
  );
}
