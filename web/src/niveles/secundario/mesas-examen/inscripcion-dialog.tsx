import { useState } from 'react';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import apiClient from '../../../api/client';
import { extractErrorMessage } from '../../../hooks/use-api';

interface Props {
  mesaId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function InscripcionDialog({ mesaId, onClose, onSuccess }: Props) {
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInscribir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim()) return;

    setLoading(true);
    setError('');
    try {
      await apiClient.post(`/v1/secundario/mesas-examen/${mesaId}/inscripciones`, {
        studentId: studentId.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div style={{ width: '400px' }}>
        <Card title="Inscribir alumno">
          {error && (
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
              {error}
            </div>
          )}
          <form onSubmit={handleInscribir}>
            <Input
              label="ID del estudiante"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="UUID del estudiante"
              required
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
              <Button type="submit" variant="success-soft" loading={loading}>
                Inscribir
              </Button>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
