import { useState, useEffect } from 'react';
import { useApiList, useApiCreate } from '../../hooks/use-api';
import { useCan } from '../../hooks/use-can';
import apiClient from '../../api/client';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

interface AcademicCycle {
  uuid: string;
  code: string;
  name: string;
}

interface Observation {
  id: string;
  studentId: string;
  type: 'PEDAGOGICAL' | 'PSYCHOPEDAGOGICAL';
  content: string;
  academicCycleId?: string;
  author?: string;
  createdAt?: string;
}

interface CreateObservationBody {
  studentId: string;
  type: string;
  content: string;
  /** SDD-2 R14: academicCycleId replaces enrollmentId. Passed directly from selected cycle. */
  academicCycleId?: string;
}

const TYPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  PEDAGOGICAL: { bg: '#dbeafe', color: '#1e40af', label: 'Pedagógica' },
  PSYCHOPEDAGOGICAL: { bg: '#f3e8ff', color: '#6b21a8', label: 'Psicopedagógica' },
};

export default function ObservationsByCyclePage() {
  const { can } = useCan();

  const [cycles, setCycles] = useState<AcademicCycle[]>([]);
  const [selectedCycleUuid, setSelectedCycleUuid] = useState('');
  const selectedCycle = cycles.find(c => c.uuid === selectedCycleUuid) ?? null;

  const listUrl = selectedCycleUuid ? `/cycles/${selectedCycleUuid}/observations` : '';
  const { data, loading, reload } = useApiList<Observation>(listUrl);
  const { creating, createError, create, setCreateError } = useApiCreate<CreateObservationBody>('/student-observations');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', type: 'PEDAGOGICAL', content: '' });

  useEffect(() => {
    apiClient
      .get('/academic-cycles', { params: { limit: '100' } })
      .then(r => setCycles(r.data?.data ?? []));
  }, []);

  const handleCreate = async () => {
    setCreateError('');
    if (!selectedCycle) return;

    // SDD-2 R14: pass academicCycleId = selectedCycle.uuid directly — no enrollment lookup.
    // PEDAGOGICAL and PSYCHOPEDAGOGICAL both use academicCycleId; backend now accepts it.
    const body: CreateObservationBody = {
      studentId: form.studentId,
      type: form.type,
      content: form.content,
    };
    if (form.type === 'PEDAGOGICAL') {
      body.academicCycleId = selectedCycle.uuid;
    }

    const ok = await create(body);
    if (ok) {
      setShowForm(false);
      setForm({ studentId: '', type: 'PEDAGOGICAL', content: '' });
      reload();
    }
  };

  const handleCycleChange = (uuid: string) => {
    setSelectedCycleUuid(uuid);
    setShowForm(false);
    setCreateError('');
  };

  const displayError = createError;

  return (
    <div>
      <PremiumHeader
        title="Observaciones por ciclo lectivo"
        icon="📋"
        stats={[{ label: 'observaciones', value: String(data.length) }]}
      >
        {can('STUDENTS', 'CREATE') && selectedCycleUuid && (
          <Button
            variant={showForm ? 'danger-soft' : 'success-soft'}
            onClick={() => {
              setShowForm(!showForm);
              setCreateError('');
            }}
          >
            {showForm ? 'Cancelar' : 'Nueva observación'}
          </Button>
        )}
      </PremiumHeader>

      {/* Ciclo lectivo selector */}
      <Card className="mt-md">
        <div className="field">
          <label htmlFor="cycle-select" className="field-label">Ciclo lectivo</label>
          <select
            id="cycle-select"
            className="input"
            value={selectedCycleUuid}
            onChange={e => handleCycleChange(e.target.value)}
          >
            <option value="">Seleccioná un ciclo lectivo</option>
            {cycles.map(c => (
              <option key={c.uuid} value={c.uuid}>{c.name}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Empty state — no cycle selected */}
      {!selectedCycleUuid && (
        <Card className="mt-md">
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Seleccioná un ciclo lectivo para ver y gestionar observaciones.
          </p>
        </Card>
      )}

      {/* Create form */}
      {selectedCycleUuid && showForm && can('STUDENTS', 'CREATE') && (
        <Card title="Nueva observación" className="mt-md">
          {displayError && (
            <div style={{
              background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem',
              borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)',
            }}>
              {displayError}
            </div>
          )}
          <div className="flex flex-col gap-md">
            <Input
              label="Estudiante ID"
              name="student-id"
              value={form.studentId}
              onChange={e => setForm({ ...form, studentId: e.target.value })}
              required
            />
            <div className="field">
              <label htmlFor="obs-type" className="field-label">Tipo</label>
              <select
                id="obs-type"
                className="input"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                <option value="PEDAGOGICAL">Pedagógica</option>
                <option value="PSYCHOPEDAGOGICAL">Psicopedagógica</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="obs-content" className="field-label">Contenido</label>
              <textarea
                id="obs-content"
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

      {/* Observations list */}
      {selectedCycleUuid && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          {loading && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-md)' }}>
              Cargando...
            </p>
          )}
          {!loading && data.length === 0 && (
            <Card>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                No hay observaciones para este ciclo lectivo.
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
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                        Alumno: {obs.studentId}
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
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
