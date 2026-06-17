import { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { extractErrorMessage } from '../../../hooks/use-api';
import apiClient from '../../../api/client';

interface SalaFormProps {
  initial?: {
    id: string;
    name: string;
    ageGroup: number;
    turno: string;
    capacity: number;
    academicYear: string;
  };
  onSaved: () => void;
  onCancel: () => void;
}

const TURNO_OPTIONS = ['MAÑANA', 'TARDE'];
const AGE_GROUP_OPTIONS = [3, 4, 5];

export default function SalaForm({ initial, onSaved, onCancel }: SalaFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    ageGroup: initial?.ageGroup ?? 3,
    turno: initial?.turno ?? 'MAÑANA',
    capacity: initial?.capacity ?? 20,
    academicYear: initial?.academicYear ?? String(new Date().getFullYear()),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) { setError('El nombre es requerido'); return; }
    if (!form.academicYear.match(/^\d{4}$/)) { setError('El año académico debe tener formato YYYY'); return; }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        ageGroup: Number(form.ageGroup),
        turno: form.turno,
        capacity: Number(form.capacity),
        academicYear: form.academicYear,
      };

      if (initial?.id) {
        await apiClient.patch(`/inicial/salas/${initial.id}`, body);
      } else {
        await apiClient.post('/inicial/salas', body);
      }
      onSaved();
    } catch (e: unknown) {
      setError(extractErrorMessage(e) || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-md">
      {error && (
        <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <Input
          label="Nombre de la sala"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          label="Año académico"
          value={form.academicYear}
          onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
          required
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Edad del grupo</label>
          <select
            value={form.ageGroup}
            onChange={(e) => setForm({ ...form, ageGroup: Number(e.target.value) })}
            style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', width: '100%' }}
          >
            {AGE_GROUP_OPTIONS.map((age) => (
              <option key={age} value={age}>{age} años</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Turno</label>
          <select
            value={form.turno}
            onChange={(e) => setForm({ ...form, turno: e.target.value })}
            style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', width: '100%' }}
          >
            {TURNO_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <Input
          label="Capacidad máxima"
          type="number"
          value={String(form.capacity)}
          onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
          required
        />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <Button variant="success-soft" onClick={handleSave} loading={saving}>
          {initial?.id ? 'Guardar cambios' : 'Crear sala'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
