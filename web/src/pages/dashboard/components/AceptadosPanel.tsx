import { useState } from 'react';
import { useCan } from '../../../hooks/use-can';
import { useApiList } from '../../../hooks/use-api';
import apiClient from '../../../api/client';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';

interface Ingresante {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  level: string;
  status: string;
}

interface AceptadosPanelProps {
  onStudentAdded?: () => void;
}

function extractMsg(e: unknown): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || 'Error';
}

export function AceptadosPanel({ onStudentAdded }: AceptadosPanelProps) {
  const { can } = useCan();
  const { data: aceptados, loading, reload } = useApiList<Ingresante>(
    '/ingresantes',
    { status: 'ACEPTADO' },
  );

  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoteError, setPromoteError] = useState('');
  const [promoted, setPromoted] = useState(false);

  if (!can('STUDENTS', 'CREATE')) return null;

  const handlePromote = async (id: string) => {
    setPromotingId(id);
    setPromoteError('');
    setPromoted(false);
    try {
      await apiClient.post(`/ingresantes/${id}/promote`);
      setPromoted(true);
      reload();
      onStudentAdded?.();
    } catch (e) {
      setPromoteError(extractMsg(e));
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <Card title="Dar de alta ingresantes aceptados" className="mt-lg">
      {promoteError && (
        <div style={{
          background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem',
          borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)',
        }}>
          {promoteError}
        </div>
      )}
      {promoted && !promoteError && (
        <div style={{
          background: '#f0fdf4', color: '#166534', padding: '0.5rem',
          borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)',
        }}>
          Ingresante dado de alta exitosamente
        </div>
      )}

      {loading && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Cargando...</p>
      )}
      {!loading && aceptados.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          No hay ingresantes aceptados pendientes de alta.
        </p>
      )}
      {!loading && aceptados.map(ingresante => (
        <div
          key={ingresante.id}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              {ingresante.lastName}, {ingresante.firstName}
            </span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', marginLeft: 'var(--space-sm)' }}>
              DNI: {ingresante.dni} · {ingresante.level}
            </span>
          </div>
          <Button
            variant="success-soft"
            size="sm"
            onClick={() => handlePromote(ingresante.id)}
            loading={promotingId === ingresante.id}
          >
            Dar de alta
          </Button>
        </div>
      ))}
    </Card>
  );
}
