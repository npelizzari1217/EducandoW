import { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';

interface CarreraFormValues {
  name: string;
  titulo: string;
  duracion: number;
  resolucion?: string;
}

interface CarreraFormProps {
  initial?: Partial<CarreraFormValues>;
  onSubmit: (values: CarreraFormValues) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function CarreraForm({ initial, onSubmit, onCancel, loading }: CarreraFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [titulo, setTitulo] = useState(initial?.titulo ?? '');
  const [duracion, setDuracion] = useState(initial?.duracion?.toString() ?? '');
  const [resolucion, setResolucion] = useState(initial?.resolucion ?? '');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !titulo.trim() || !duracion) {
      setError('Nombre, título y duración son obligatorios.');
      return;
    }
    const dur = parseInt(duracion, 10);
    if (isNaN(dur) || dur < 1) {
      setError('La duración debe ser un número positivo.');
      return;
    }
    try {
      await onSubmit({ name: name.trim(), titulo: titulo.trim(), duracion: dur, resolucion: resolucion.trim() || undefined });
    } catch (err) {
      setError((err as Error).message ?? 'Error al guardar.');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <Input label="Nombre de la carrera *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Tecnicatura en Administración" />
      <Input label="Título que otorga *" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Técnico Superior en Administración" />
      <Input label="Duración (años) *" type="number" value={duracion} onChange={(e) => setDuracion(e.target.value)} min={1} max={10} placeholder="Ej: 3" />
      <Input label="N° Resolución" value={resolucion} onChange={(e) => setResolucion(e.target.value)} placeholder="Opcional" />
      {error && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
        <Button variant="ghost" type="button" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button variant="action" type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  );
}
