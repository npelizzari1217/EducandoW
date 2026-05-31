import { useState } from 'react';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';

interface CursoFormValues {
  year: number;
  division: string;
  orientacion: string;
  academicYear: string;
}

interface Props {
  onSubmit: (values: CursoFormValues) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error: string;
}

const ORIENTACIONES = ['', 'NATURALES', 'SOCIALES', 'ECONOMIA', 'ARTE'] as const;

export function CursoForm({ onSubmit, onCancel, loading, error }: Props) {
  const [form, setForm] = useState<CursoFormValues>({
    year: 1,
    division: 'A',
    orientacion: '',
    academicYear: String(new Date().getFullYear()),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  return (
    <Card title="Nuevo curso">
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
          <div className="field">
            <label className="field-label">Año</label>
            <select
              className="input"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6].map((y) => (
                <option key={y} value={y}>{y}°</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">División</label>
            <select
              className="input"
              value={form.division}
              onChange={(e) => setForm({ ...form, division: e.target.value })}
            >
              {['A', 'B', 'C'].map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Orientación</label>
            <select
              className="input"
              value={form.orientacion}
              onChange={(e) => setForm({ ...form, orientacion: e.target.value })}
            >
              {ORIENTACIONES.map((o) => (
                <option key={o} value={o}>{o || 'Sin orientación'}</option>
              ))}
            </select>
          </div>
          <Input
            label="Año lectivo"
            value={form.academicYear}
            onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
            required
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <Button type="submit" variant="success-soft" loading={loading}>Crear curso</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        </div>
      </form>
    </Card>
  );
}
