import { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';

interface InscripcionFormValues {
  studentId: string;
  materiaCarreraId: string;
  cuatrimestre: '1C' | '2C' | 'ANUAL';
  anioAcademico: string;
}

interface InscripcionFormProps {
  onSubmit: (values: InscripcionFormValues) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const CUATRIMESTRES = [
  { value: '1C', label: '1° Cuatrimestre' },
  { value: '2C', label: '2° Cuatrimestre' },
  { value: 'ANUAL', label: 'Anual' },
] as const;

export function InscripcionForm({ onSubmit, onCancel, loading }: InscripcionFormProps) {
  const [studentId, setStudentId] = useState('');
  const [materiaCarreraId, setMateriaCarreraId] = useState('');
  const [cuatrimestre, setCuatrimestre] = useState<'1C' | '2C' | 'ANUAL'>('1C');
  const [anioAcademico, setAnioAcademico] = useState(new Date().getFullYear().toString());
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!studentId.trim() || !materiaCarreraId.trim() || !anioAcademico.trim()) {
      setError('Todos los campos son obligatorios.');
      return;
    }
    try {
      await onSubmit({ studentId: studentId.trim(), materiaCarreraId: materiaCarreraId.trim(), cuatrimestre, anioAcademico: anioAcademico.trim() });
    } catch (err) {
      setError((err as Error).message ?? 'Error al inscribir.');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <Input label="ID del alumno *" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="UUID del alumno" />
      <Input label="ID de materia-carrera *" value={materiaCarreraId} onChange={(e) => setMateriaCarreraId(e.target.value)} placeholder="UUID de la materia en la carrera" />
      <div>
        <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-xs)' }}>
          Cuatrimestre *
        </label>
        <select
          value={cuatrimestre}
          onChange={(e) => setCuatrimestre(e.target.value as '1C' | '2C' | 'ANUAL')}
          style={{ width: '100%', padding: 'var(--space-sm)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
        >
          {CUATRIMESTRES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <Input label="Año académico *" value={anioAcademico} onChange={(e) => setAnioAcademico(e.target.value)} placeholder="Ej: 2026" maxLength={4} />
      {error && <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
        <Button variant="ghost" type="button" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button variant="action" type="submit" disabled={loading}>{loading ? 'Inscribiendo...' : 'Inscribir'}</Button>
      </div>
    </form>
  );
}
