import { useState } from 'react';
import { useApiList, useApiCreate, useApiDelete } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

interface Observation {
  id: string;
  studentId: string;
  type: 'PEDAGOGICAL' | 'PSYCHOPEDAGOGICAL';
  content: string;
  author?: string;
  createdAt?: string;
}

const TYPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  PEDAGOGICAL: { bg: '#dbeafe', color: '#1e40af', label: 'Pedagógica' },
  PSYCHOPEDAGOGICAL: { bg: '#f3e8ff', color: '#6b21a8', label: 'Psicopedagógica' },
};

export default function ObservationsPage() {
  const [studentId, setStudentId] = useState('');

  const listUrl = studentId ? `/students/${studentId}/observations` : '';
  const { data, loading, reload } = useApiList<Observation>(listUrl);
  const { creating, createError, create } = useApiCreate<{ studentId: string; type: string; content: string }>('/student-observations');
  const { deleting, del } = useApiDelete('/student-observations');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', type: 'PEDAGOGICAL', content: '' });

  const handleCreate = async () => {
    const ok = await create({ studentId: form.studentId, type: form.type, content: form.content });
    if (ok) {
      setShowForm(false);
      setForm({ studentId: '', type: 'PEDAGOGICAL', content: '' });
      if (studentId === form.studentId) reload();
      else setStudentId(form.studentId);
    }
  };

  return (
    <div>
      <PremiumHeader
        title="Observaciones"
        icon="👁️"
        stats={[
          { label: 'observaciones', value: String(data.length) },
        ]}
      >
        <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : 'Nueva observación'}
        </Button>
      </PremiumHeader>

      <div className="flex gap-md items-center" style={{ marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <Input
          label="Estudiante ID"
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          placeholder="Buscar por ID de estudiante"
        />
        <Button variant="ghost" onClick={reload} style={{ marginTop: '1.25rem' }}>Buscar</Button>
      </div>

      {showForm && (
        <Card title="Nueva observación" className="mt-md">
          {createError && (
            <div style={{
              background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem',
              borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)',
            }}>
              {createError}
            </div>
          )}
          <div className="flex flex-col gap-md">
            <Input
              label="Estudiante ID"
              value={form.studentId}
              onChange={e => setForm({ ...form, studentId: e.target.value })}
              required
            />
            <div className="field">
              <label className="field-label">Tipo</label>
              <select
                className="input"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                <option value="PEDAGOGICAL">Pedagógica</option>
                <option value="PSYCHOPEDAGOGICAL">Psicopedagógica</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label">Contenido</label>
              <textarea
                className="input"
                rows={4}
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                required
                style={{ resize: 'vertical' }}
              />
            </div>
            <Button variant="success-soft" onClick={handleCreate} loading={creating}>
              Guardar observación
            </Button>
          </div>
        </Card>
      )}

      <div style={{ marginTop: 'var(--space-lg)' }}>
        {loading && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-md)' }}>Cargando...</p>}
        {!loading && !studentId && (
          <Card>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Ingresá un ID de estudiante para ver sus observaciones.
            </p>
          </Card>
        )}
        {!loading && studentId && data.length === 0 && (
          <Card>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              No hay observaciones para este estudiante.
            </p>
          </Card>
        )}
        {!loading && data.map(obs => {
          const badge = TYPE_BADGE[obs.type] ?? TYPE_BADGE.PEDAGOGICAL;
          return (
            <Card key={obs.id} className="mt-sm">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                    <span style={{
                      background: badge.bg, color: badge.color,
                      padding: '0.15rem 0.6rem', borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--text-xs)', fontWeight: 600,
                    }}>
                      {badge.label}
                    </span>
                    {obs.author && (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                        por {obs.author}
                      </span>
                    )}
                    {obs.createdAt && (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                        {new Date(obs.createdAt).toLocaleDateString('es-AR')}
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--color-text)', fontSize: 'var(--text-sm)', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {obs.content}
                  </p>
                </div>
                <Button
                  variant="danger-soft"
                  size="sm"
                  onClick={() => del(obs.id).then(() => reload())}
                  loading={deleting}
                >
                  Eliminar
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
