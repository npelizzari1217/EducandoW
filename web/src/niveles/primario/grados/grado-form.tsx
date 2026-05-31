import { useState } from 'react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface GradoFormData {
  grade: number;
  division: string;
  academicYear: string;
  teacherId: string;
  courseSectionId: string;
}

interface GradoFormProps {
  onSubmit: (data: GradoFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error: string;
}

const GRADES = [1, 2, 3, 4, 5, 6];
const DIVISIONS = ['A', 'B', 'C'];

export function GradoForm({ onSubmit, onCancel, loading, error }: GradoFormProps) {
  const [form, setForm] = useState<GradoFormData>({
    grade: 1,
    division: 'A',
    academicYear: String(new Date().getFullYear()),
    teacherId: '',
    courseSectionId: '',
  });

  const handleSubmit = async () => {
    await onSubmit({
      ...form,
      teacherId: form.teacherId.trim() || '',
      courseSectionId: form.courseSectionId.trim() || '',
    });
  };

  return (
    <Card title="Nuevo Grado" className="mt-md">
      {error && (
        <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
          {error}
        </div>
      )}
      <div className="flex flex-col gap-md">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Grado</label>
            <select
              value={form.grade}
              onChange={e => setForm({ ...form, grade: Number(e.target.value) })}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}
            >
              {GRADES.map(g => <option key={g} value={g}>{g}°</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>División</label>
            <select
              value={form.division}
              onChange={e => setForm({ ...form, division: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}
            >
              {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <Input
          label="Año lectivo"
          value={form.academicYear}
          onChange={e => setForm({ ...form, academicYear: e.target.value })}
          required
        />
        <Input
          label="Docente ID (opcional)"
          value={form.teacherId}
          onChange={e => setForm({ ...form, teacherId: e.target.value })}
        />
        <Input
          label="Sección ID (opcional)"
          value={form.courseSectionId}
          onChange={e => setForm({ ...form, courseSectionId: e.target.value })}
        />
        <div className="flex gap-md">
          <Button variant="success-soft" onClick={handleSubmit} loading={loading}>Crear grado</Button>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    </Card>
  );
}
