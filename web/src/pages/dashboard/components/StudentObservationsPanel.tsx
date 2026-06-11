import { useState, useEffect } from 'react';
import { useApiList, useApiCreate } from '../../../hooks/use-api';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import apiClient from '../../../api/client';

// ── Interfaces ─────────────────────────────────────────────

interface Observation {
  id: string;
  studentId: string;
  type: 'PEDAGOGICAL' | 'PSYCHOPEDAGOGICAL';
  content: string;
  author?: string;
  createdAt?: string;
}

interface Enrollment {
  id: string;
  studentId: string;
  status: string;
}

const TYPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  PEDAGOGICAL: { bg: '#dbeafe', color: '#1e40af', label: 'Pedagógica' },
  PSYCHOPEDAGOGICAL: { bg: '#f3e8ff', color: '#6b21a8', label: 'Psicopedagógica' },
};

const TYPE_LABEL: Record<'PEDAGOGICAL' | 'PSYCHOPEDAGOGICAL', string> = {
  PEDAGOGICAL: 'pedagógicas',
  PSYCHOPEDAGOGICAL: 'psicopedagógicas',
};

// ── Component ──────────────────────────────────────────────

interface StudentObservationsPanelProps {
  studentId: string;
  institutionId?: string;
  type: 'PEDAGOGICAL' | 'PSYCHOPEDAGOGICAL';
}

export function StudentObservationsPanel({
  studentId,
  institutionId,
  type,
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
    enrollmentId?: string;
    institutionId?: string;
  }>('/student-observations', tenantParams);

  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');

  // ── PEDAGOGICAL: resolve active enrollment on mount ────────
  const [activeEnrollmentId, setActiveEnrollmentId] = useState<string | null>(null);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [noActiveEnrollment, setNoActiveEnrollment] = useState(false);

  useEffect(() => {
    if (type !== 'PEDAGOGICAL') return;
    setEnrollmentLoading(true);
    const params: Record<string, string> = { studentId };
    if (institutionId) params.institutionId = institutionId;
    apiClient
      .get('/enrollments', { params })
      .then((res) => {
        const list = (res.data?.data ?? []) as Enrollment[];
        const active = list.find((e) => e.status === 'ACTIVE') ?? null;
        if (active) {
          setActiveEnrollmentId(active.id);
          setNoActiveEnrollment(false);
        } else {
          setNoActiveEnrollment(true);
        }
      })
      .catch(() => {
        setNoActiveEnrollment(true);
      })
      .finally(() => setEnrollmentLoading(false));
  }, [type, studentId, institutionId]);

  const isCreateDisabled =
    type === 'PEDAGOGICAL' && (enrollmentLoading || noActiveEnrollment);

  const handleCreate = async () => {
    const body: {
      studentId: string;
      type: string;
      content: string;
      enrollmentId?: string;
      institutionId?: string;
    } = {
      studentId,
      type,
      content,
      ...(institutionId ? { institutionId } : {}),
    };
    if (type === 'PEDAGOGICAL' && activeEnrollmentId) {
      body.enrollmentId = activeEnrollmentId;
    }
    const ok = await create(body);
    if (ok) {
      setShowForm(false);
      setContent('');
      reload();
    }
  };

  // Client-side filter: only show observations matching this panel's type
  const filtered = data.filter((obs) => obs.type === type);
  const typeLabel = TYPE_LABEL[type];

  return (
    <div>
      {/* Toggle button */}
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <Button
          variant={showForm ? 'danger-soft' : 'success-soft'}
          size="sm"
          onClick={() => setShowForm(!showForm)}
          disabled={isCreateDisabled}
        >
          {showForm ? 'Cancelar' : 'Nueva observación'}
        </Button>
      </div>

      {/* No active enrollment warning */}
      {type === 'PEDAGOGICAL' && !enrollmentLoading && noActiveEnrollment && (
        <div
          style={{
            background: '#fefce8',
            color: '#854d0e',
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-md)',
            fontSize: 'var(--text-sm)',
          }}
        >
          El alumno no tiene una inscripción activa para registrar observaciones pedagógicas.
        </div>
      )}

      {/* Create form */}
      {showForm && !isCreateDisabled && (
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
              <label className="field-label">Contenido</label>
              <textarea
                className="input"
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
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
        {!loading && filtered.length === 0 && (
          <Card>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              No hay observaciones {typeLabel} para este alumno.
            </p>
          </Card>
        )}
        {!loading &&
          filtered.map((obs) => {
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
