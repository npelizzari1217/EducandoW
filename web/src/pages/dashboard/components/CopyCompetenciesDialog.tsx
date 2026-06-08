import { useState } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import apiClient from '../../../api/client';
import { PlanCourseSubjectSelector } from './PlanCourseSubjectSelector';

// ── Props ────────────────────────────────────────────────────

interface Props {
  targetStudyPlanSubjectId: string;
  onSuccess: () => void;
  onClose: () => void;
}

interface CopyResult {
  copied: number;
  skipped: number;
}

// ── Component ────────────────────────────────────────────────

export function CopyCompetenciesDialog({ targetStudyPlanSubjectId, onSuccess, onClose }: Props) {
  const [sourceStudyPlanSubjectId, setSourceStudyPlanSubjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CopyResult | null>(null);
  const [error, setError] = useState('');

  const handleCopy = async () => {
    if (!sourceStudyPlanSubjectId) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await apiClient.post('/subject-competencies/copy', {
        sourceStudyPlanSubjectId,
        targetStudyPlanSubjectId,
      });
      const data: CopyResult = r.data?.data ?? { copied: 0, skipped: 0 };
      setResult(data);
      onSuccess();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Error al copiar competencias');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div style={{ maxWidth: 640, width: '90%' }}>
        <Card title="Copiar competencias desde otro curso">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            Seleccioná el plan, curso y materia de origen para copiar sus competencias activas.
          </p>

          {/* Source selector */}
          <PlanCourseSubjectSelector onSubjectSelect={setSourceStudyPlanSubjectId} />

          {/* Error */}
          {error && (
            <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
              {error}
            </div>
          )}

          {/* Result feedback */}
          {result !== null && (
            <div
              style={{
                background: result.copied === 0 && result.skipped === 0 ? '#fef9c3' : '#f0fdf4',
                color: result.copied === 0 && result.skipped === 0 ? '#854d0e' : '#15803d',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                marginTop: 'var(--space-md)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {result.copied === 0 && result.skipped === 0
                ? 'Sin competencias activas en la materia seleccionada'
                : `Copiadas: ${result.copied} — Omitidas: ${result.skipped}`}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button
              variant="success-soft"
              onClick={handleCopy}
              loading={loading}
              disabled={!sourceStudyPlanSubjectId}
            >
              Copiar competencias
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default CopyCompetenciesDialog;
