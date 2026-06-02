import { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { extractErrorMessage } from '../../../hooks/use-api';
import apiClient from '../../../api/client';

interface AreaDesarrollo {
  area: string;
  observacion: string;
  valoracion: string;
}

interface InformeFormProps {
  initial?: {
    id: string;
    studentId: string;
    salaId: string;
    periodo: string;
    fecha: string;
    observacionesGenerales?: string;
    areas: Array<{ id: string; informeId: string; area: string; observacion: string; valoracion: string }>;
  };
  onSaved: () => void;
  onCancel: () => void;
}

const PERIODO_OPTIONS = ['1T', '2T', '3T'];

export default function InformeForm({ initial, onSaved, onCancel }: InformeFormProps) {
  const [form, setForm] = useState({
    studentId: initial?.studentId ?? '',
    salaId: initial?.salaId ?? '',
    periodo: initial?.periodo ?? '1T',
    fecha: initial?.fecha ? initial.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
    observacionesGenerales: initial?.observacionesGenerales ?? '',
  });
  const [areas, setAreas] = useState<AreaDesarrollo[]>(
    initial?.areas.map(({ area, observacion, valoracion }) => ({ area, observacion, valoracion })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addArea = () => {
    setAreas([...areas, { area: '', observacion: '', valoracion: '' }]);
  };

  const removeArea = (index: number) => {
    setAreas(areas.filter((_, i) => i !== index));
  };

  const updateArea = (index: number, field: keyof AreaDesarrollo, value: string) => {
    setAreas(areas.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    setError('');
    if (!form.studentId.trim()) { setError('El ID del estudiante es requerido'); return; }
    if (!form.salaId.trim()) { setError('El ID de la sala es requerido'); return; }

    setSaving(true);
    try {
      const body = {
        studentId: form.studentId,
        salaId: form.salaId,
        periodo: form.periodo,
        fecha: form.fecha,
        observacionesGenerales: form.observacionesGenerales || undefined,
        areas,
      };

      if (initial?.id) {
        await apiClient.patch(`/inicial/informes/${initial.id}`, {
          periodo: form.periodo,
          fecha: form.fecha,
          observacionesGenerales: form.observacionesGenerales || undefined,
          areas,
        });
      } else {
        await apiClient.post('/inicial/informes', body);
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
          label="ID del estudiante"
          value={form.studentId}
          onChange={(e) => setForm({ ...form, studentId: e.target.value })}
          required
          disabled={!!initial?.id}
        />
        <Input
          label="ID de la sala"
          value={form.salaId}
          onChange={(e) => setForm({ ...form, salaId: e.target.value })}
          required
          disabled={!!initial?.id}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Período</label>
          <select
            value={form.periodo}
            onChange={(e) => setForm({ ...form, periodo: e.target.value })}
            style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', width: '100%' }}
          >
            {PERIODO_OPTIONS.map((p) => (
              <option key={p} value={p}>{p === '1T' ? '1° Trimestre' : p === '2T' ? '2° Trimestre' : '3° Trimestre'}</option>
            ))}
          </select>
        </div>

        <Input
          label="Fecha"
          type="date"
          value={form.fecha}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          required
        />
      </div>

      <div>
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Observaciones generales</label>
        <textarea
          value={form.observacionesGenerales}
          onChange={(e) => setForm({ ...form, observacionesGenerales: e.target.value })}
          rows={3}
          style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', width: '100%', resize: 'vertical' }}
        />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Áreas de desarrollo</label>
          <Button variant="ghost" size="sm" onClick={addArea}>+ Agregar área</Button>
        </div>

        {areas.map((area, index) => (
          <div key={index} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 'var(--space-sm)', alignItems: 'end' }}>
              <Input
                label="Área"
                value={area.area}
                onChange={(e) => updateArea(index, 'area', e.target.value)}
              />
              <Input
                label="Observación"
                value={area.observacion}
                onChange={(e) => updateArea(index, 'observacion', e.target.value)}
              />
              <Input
                label="Valoración"
                value={area.valoracion}
                onChange={(e) => updateArea(index, 'valoracion', e.target.value)}
              />
              <Button variant="danger-soft" size="sm" onClick={() => removeArea(index)}>✕</Button>
            </div>
          </div>
        ))}

        {areas.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>No hay áreas de desarrollo agregadas</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <Button variant="success-soft" onClick={handleSave} loading={saving}>
          {initial?.id ? 'Guardar cambios' : 'Crear informe'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
