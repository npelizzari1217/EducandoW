import { useState } from 'react';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';

interface MesaExamenFormValues {
  subjectId: string;
  fecha: string;
  turno: string;
  presidenteId: string;
}

interface Props {
  onSubmit: (values: MesaExamenFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error: string;
}

const TURNOS = ['DICIEMBRE', 'FEBRERO'] as const;

export function MesaExamenForm({ onSubmit, onCancel, loading, error }: Props) {
  const [form, setForm] = useState<MesaExamenFormValues>({
    subjectId: '',
    fecha: '',
    turno: 'DICIEMBRE',
    presidenteId: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  return (
    <Card title="Nueva mesa de examen">
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
      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-md)',
            marginBottom: 'var(--space-md)',
          }}
        >
          <Input
            label="ID de materia"
            value={form.subjectId}
            onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            placeholder="UUID de la materia"
            required
          />
          <Input
            label="ID del presidente"
            value={form.presidenteId}
            onChange={(e) => setForm({ ...form, presidenteId: e.target.value })}
            placeholder="UUID del docente presidente"
            required
          />
          <Input
            label="Fecha"
            type="datetime-local"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            required
          />
          <div className="field">
            <label className="field-label">Turno</label>
            <select
              className="input"
              value={form.turno}
              onChange={(e) => setForm({ ...form, turno: e.target.value })}
            >
              {TURNOS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <Button type="submit" variant="success-soft" loading={loading}>
            Crear mesa
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
