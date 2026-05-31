import { useState } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface CalificacionFormData {
  studentId: string;
  gradoId: string;
  subjectId: string;
  trimestre: string;
  nota: number;
  concepto: string;
  aprobado: boolean;
}

interface CalificacionFormProps {
  onSubmit: (data: CalificacionFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error: string;
}

const TRIMESTRES = ['1T', '2T', '3T'];
const CONCEPTOS = ['EXCELENTE', 'MUY_BUENO', 'BUENO', 'REGULAR', 'INSUFICIENTE'];

export function CalificacionForm({ onSubmit, onCancel, loading, error }: CalificacionFormProps) {
  const [form, setForm] = useState<CalificacionFormData>({
    studentId: '',
    gradoId: '',
    subjectId: '',
    trimestre: '1T',
    nota: 7,
    concepto: 'BUENO',
    aprobado: true,
  });

  const handleSubmit = async () => {
    await onSubmit(form);
  };

  return (
    <Card title="Nueva Calificación" className="mt-md">
      {error && (
        <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
          {error}
        </div>
      )}
      <div className="flex flex-col gap-md">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <Input
            label="Estudiante ID"
            value={form.studentId}
            onChange={e => setForm({ ...form, studentId: e.target.value })}
            required
          />
          <Input
            label="Grado ID"
            value={form.gradoId}
            onChange={e => setForm({ ...form, gradoId: e.target.value })}
            required
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <Input
            label="Materia ID"
            value={form.subjectId}
            onChange={e => setForm({ ...form, subjectId: e.target.value })}
            required
          />
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Trimestre</label>
            <select
              value={form.trimestre}
              onChange={e => setForm({ ...form, trimestre: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}
            >
              {TRIMESTRES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Nota (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              step={0.1}
              value={form.nota}
              onChange={e => setForm({ ...form, nota: Number(e.target.value) })}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Concepto</label>
            <select
              value={form.concepto}
              onChange={e => setForm({ ...form, concepto: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}
            >
              {CONCEPTOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={form.aprobado}
                onChange={e => setForm({ ...form, aprobado: e.target.checked })}
              />
              Aprobado
            </label>
          </div>
        </div>
        <div className="flex gap-md">
          <Button variant="success-soft" onClick={handleSubmit} loading={loading}>Registrar calificación</Button>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    </Card>
  );
}
