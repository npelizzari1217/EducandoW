import { useState, useEffect, useCallback } from 'react';
import PremiumHeader from '../../../components/ui/premium-header';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import apiClient from '../../../api/client';
import { InscripcionForm } from './inscripcion-form';

interface Inscripcion {
  [key: string]: unknown;
  id: string;
  studentId: string;
  materiaCarreraId: string;
  cuatrimestre: string;
  anioAcademico: string;
  estado: string;
  notaCursada?: number;
  notaFinal?: number;
}

const ESTADO_LABELS: Record<string, string> = {
  INSCRIPTO: 'Inscripto',
  CURSANDO: 'Cursando',
  REGULAR: 'Regular',
  APROBADO: 'Aprobado',
  LIBRE: 'Libre',
};

export default function InscripcionesPage() {
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentIdFilter, setStudentIdFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (studentIdFilter.trim()) params.studentId = studentIdFilter.trim();
      const res = await apiClient.get('/v1/terciario/inscripciones', { params });
      setInscripciones(res.data?.data ?? []);
    } catch {
      setError('No se pudieron cargar las inscripciones.');
    } finally {
      setLoading(false);
    }
  }, [studentIdFilter]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (values: { studentId: string; materiaCarreraId: string; cuatrimestre: string; anioAcademico: string }) => {
    setSaving(true);
    try {
      await apiClient.post('/v1/terciario/inscripciones', values);
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEstado = async (id: string, estado: string) => {
    try {
      await apiClient.patch(`/v1/terciario/inscripciones/${id}/estado`, { estado });
      await load();
    } catch {
      setError('No se pudo actualizar el estado.');
    }
  };

  return (
    <div>
      <PremiumHeader
        title="Inscripciones a Materias"
        subtitle="Gestión de inscripciones de alumnos a materias del nivel terciario"
        icon="📝"
      >
        {!showForm && (
          <Button variant="action" onClick={() => setShowForm(true)}>+ Nueva inscripción</Button>
        )}
      </PremiumHeader>

      {showForm && (
        <Card title="Nueva inscripción" className="mt-md">
          <InscripcionForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            loading={saving}
          />
        </Card>
      )}

      <Card className="mt-md">
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <Input
            label="Filtrar por alumno (ID)"
            value={studentIdFilter}
            onChange={(e) => setStudentIdFilter(e.target.value)}
            placeholder="Ingresá el ID del alumno para filtrar"
          />
        </div>
        {loading && <p style={{ padding: 'var(--space-md)', textAlign: 'center' }}>Cargando...</p>}
        {error && <p style={{ color: 'var(--color-danger)', padding: 'var(--space-md)' }}>{error}</p>}
        {!loading && (
          <Table
            columns={[
              { key: 'studentId', header: 'Alumno ID' },
              { key: 'materiaCarreraId', header: 'Materia ID' },
              { key: 'cuatrimestre', header: 'Cuatrimestre' },
              { key: 'anioAcademico', header: 'Año' },
              { key: 'estado', header: 'Estado', render: (i: Inscripcion) => ESTADO_LABELS[i.estado] ?? i.estado },
              { key: 'notaCursada', header: 'Nota cursada', render: (i: Inscripcion) => i.notaCursada?.toString() ?? '-' },
              { key: 'notaFinal', header: 'Nota final', render: (i: Inscripcion) => i.notaFinal?.toString() ?? '-' },
              {
                key: 'actions', header: 'Cambiar estado',
                render: (i: Inscripcion) => (
                  <select
                    value={i.estado}
                    onChange={(e) => handleUpdateEstado(i.id, e.target.value)}
                    style={{ padding: 'var(--space-xs)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                  >
                    {Object.entries(ESTADO_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                ),
              },
            ]}
            data={inscripciones}
            emptyMessage="No hay inscripciones registradas"
          />
        )}
      </Card>
    </div>
  );
}
