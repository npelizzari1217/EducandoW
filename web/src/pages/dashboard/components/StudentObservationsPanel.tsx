import { useState } from 'react';
import { useApiList, useApiCreate } from '../../../hooks/use-api';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

// ── Interfaces ─────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────

interface StudentObservationsPanelProps {
  studentId: string;
  institutionId?: string;
}

export function StudentObservationsPanel({
  studentId,
  institutionId,
}: StudentObservationsPanelProps) {
  const tenantParams: Record<string, string> | undefined = institutionId
    ? { institutionId }
    : undefined;

  const { data, loading, reload } = useApiList<Observation>(
    `/students/${studentId}/observations`,
    tenantParams,
  );

  const { creating, createError, create } = useApiCreate<{
    studentId: string;
    type: string;
    content: string;
    institutionId?: string;
  }>('/student-observations', tenantParams);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'PEDAGOGICAL', content: '' });

  const handleCreate = async () => {
    const body = {
      studentId,
      type: form.type,
      content: form.content,
      ...(institutionId ? { institutionId } : {}),
    };
    const ok = await create(body);
    if (ok) {
      setShowForm(false);
      setForm({ type: 'PEDAGOGICAL', content: '' });
      reload();
    }
  };

  return (
    <div>
      {/* Toggle button */}
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <Button
          variant={showForm ? 'danger-soft' : 'success-soft'}
          size="sm"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : 'Nueva observación'}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card title="Nueva observación" className="mt-sm">
          {createError && (
            <div
              style={{
                background: '#fef2f2',
                color: 'var(--color-danger)',
                padding: '0.5rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-md)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {createError}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="field">
              <label className="field-label">Tipo</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
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
                onChange={(e) => setForm({ ...form, content: e.target.value })}
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
      <div style={{ marginTop: 'var(--space-md)' }}>
        {loading && (
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
              padding: 'var(--space-md)',
            }}
          >
            Cargando...
          </p>
        )}
        {!loading && data.length === 0 && (
          <Card>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              No hay observaciones para este estudiante.
            </p>
          </Card>
        )}
        {!loading &&
          data.map((obs) => {
            const badge = TYPE_BADGE[obs.type] ?? TYPE_BADGE.PEDAGOGICAL;
            return (
              <Card key={obs.id} className="mt-sm">
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-sm)',
                      marginBottom: 'var(--space-sm)',
                    }}
                  >
                    <span
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        padding: '0.15rem 0.6rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                      }}
                    >
                      {badge.label}
                    </span>
                    {obs.author && (
                      <span
                        style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}
                      >
                        por {obs.author}
                      </span>
                    )}
                    {obs.createdAt && (
                      <span
                        style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}
                      >
                        {new Date(obs.createdAt).toLocaleDateString('es-AR')}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-sm)',
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                    }}
                  >
                    {obs.content}
                  </p>
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
