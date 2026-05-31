import { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { extractErrorMessage } from '../../../hooks/use-api';
import apiClient from '../../../api/client';

interface SecuenciaForm {
  nombre: string;
  area: string;
  actividades: string;
  recursos: string;
}

interface PlanificacionFormProps {
  initial?: {
    id: string;
    salaId: string;
    semana: number;
    academicYear: string;
    secuencias: Array<{ id: string; planificacionId: string; nombre: string; area: string; actividades: string[]; recursos: string[] }>;
  };
  onSaved: () => void;
  onCancel: () => void;
}

export default function PlanificacionForm({ initial, onSaved, onCancel }: PlanificacionFormProps) {
  const [form, setForm] = useState({
    salaId: initial?.salaId ?? '',
    semana: initial?.semana ?? 1,
    academicYear: initial?.academicYear ?? String(new Date().getFullYear()),
  });
  const [secuencias, setSecuencias] = useState<SecuenciaForm[]>(
    initial?.secuencias.map(({ nombre, area, actividades, recursos }) => ({
      nombre,
      area,
      actividades: actividades.join(', '),
      recursos: recursos.join(', '),
    })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addSecuencia = () => {
    setSecuencias([...secuencias, { nombre: '', area: '', actividades: '', recursos: '' }]);
  };

  const removeSecuencia = (index: number) => {
    setSecuencias(secuencias.filter((_, i) => i !== index));
  };

  const updateSecuencia = (index: number, field: keyof SecuenciaForm, value: string) => {
    setSecuencias(secuencias.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const parseList = (value: string): string[] =>
    value.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSave = async () => {
    setError('');
    if (!form.salaId.trim()) { setError('El ID de la sala es requerido'); return; }
    if (!form.academicYear.match(/^\d{4}$/)) { setError('El año académico debe tener formato YYYY'); return; }
    if (form.semana < 1 || form.semana > 40) { setError('La semana debe estar entre 1 y 40'); return; }

    setSaving(true);
    try {
      const secuenciasPayload = secuencias.map(({ nombre, area, actividades, recursos }) => ({
        nombre,
        area,
        actividades: parseList(actividades),
        recursos: parseList(recursos),
      }));

      if (initial?.id) {
        await apiClient.patch(`/v1/inicial/planificaciones/${initial.id}`, {
          semana: Number(form.semana),
          academicYear: form.academicYear,
          secuencias: secuenciasPayload,
        });
      } else {
        await apiClient.post('/v1/inicial/planificaciones', {
          salaId: form.salaId,
          semana: Number(form.semana),
          academicYear: form.academicYear,
          secuencias: secuenciasPayload,
        });
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
        <Input
          label="ID de la sala"
          value={form.salaId}
          onChange={(e) => setForm({ ...form, salaId: e.target.value })}
          required
          disabled={!!initial?.id}
        />
        <Input
          label="Semana (1-40)"
          type="number"
          value={String(form.semana)}
          onChange={(e) => setForm({ ...form, semana: Number(e.target.value) })}
          required
        />
        <Input
          label="Año académico"
          value={form.academicYear}
          onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
          required
        />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Secuencias didácticas</label>
          <Button variant="ghost" size="sm" onClick={addSecuencia}>+ Agregar secuencia</Button>
        </div>

        {secuencias.map((seq, index) => (
          <div key={index} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 'var(--space-sm)', alignItems: 'end', marginBottom: 'var(--space-sm)' }}>
              <Input
                label="Nombre"
                value={seq.nombre}
                onChange={(e) => updateSecuencia(index, 'nombre', e.target.value)}
              />
              <Input
                label="Área"
                value={seq.area}
                onChange={(e) => updateSecuencia(index, 'area', e.target.value)}
              />
              <Button variant="danger-soft" size="sm" onClick={() => removeSecuencia(index)}>✕</Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
              <Input
                label="Actividades (separadas por coma)"
                value={seq.actividades}
                onChange={(e) => updateSecuencia(index, 'actividades', e.target.value)}
              />
              <Input
                label="Recursos (separados por coma)"
                value={seq.recursos}
                onChange={(e) => updateSecuencia(index, 'recursos', e.target.value)}
              />
            </div>
          </div>
        ))}

        {secuencias.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>No hay secuencias didácticas agregadas</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <Button variant="success-soft" onClick={handleSave} loading={saving}>
          {initial?.id ? 'Guardar cambios' : 'Crear planificación'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
