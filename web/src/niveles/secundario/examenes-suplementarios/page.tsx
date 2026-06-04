import { useState, useCallback } from 'react';
import apiClient from '../../../api/client';
import { adaptListResponse } from '../../../api/adapters';
import PremiumHeader from '../../../components/ui/premium-header';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface AlumnoExamen extends Record<string, unknown> {
  id: string; // calificacion ID
  studentId: string;
  studentName: string;
  subjectName: string;
  cursoName: string;
  condicion: string;
  nota: number | null;
  notaDiciembre: number | null;
  notaFebrero: number | null;
  definitiva: number | null;
}

const TURNO_OPTS = [
  { value: 'DICIEMBRE', label: 'Diciembre' },
  { value: 'FEBRERO', label: 'Febrero' },
];

export default function ExamenesSuplementariosPage() {
  const [turno, setTurno] = useState('DICIEMBRE');
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<AlumnoExamen[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [definitivas, setDefinitivas] = useState<Record<string, number | null>>({});

  const buscar = useCallback(async () => {
    setLoading(true);
    setError('');
    setDefinitivas({});
    try {
      const res = await apiClient.get('/secundario/alumnos-examen', {
        params: { turno, academicYear },
      });
      const list = adaptListResponse<AlumnoExamen>(res);
      setData(list);
      setNotas({});
    } catch {
      setError('Error al buscar alumnos');
    } finally {
      setLoading(false);
    }
  }, [turno, academicYear]);

  const handleRegistrarNota = async (id: string) => {
    const nota = notas[id];
    if (!nota || isNaN(Number(nota))) return;
    setSaving((prev) => ({ ...prev, [id]: true }));
    try {
      await apiClient.patch(`/secundario/calificaciones/${id}/suplementaria`, {
        turno,
        nota: Number(nota),
      });
      setNotas((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      buscar();
    } catch {
      setError('Error al registrar nota');
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleCalcularDefinitiva = async (id: string) => {
    try {
      const res = await apiClient.post(`/secundario/calificaciones/${id}/definitiva`);
      const def = res.data?.data?.definitiva ?? null;
      setDefinitivas((prev) => ({ ...prev, [id]: def }));
    } catch {
      setError('Error al calcular definitiva');
    }
  };

  const columns = [
    { key: 'studentName', header: 'Alumno', render: (row: AlumnoExamen) => row.studentName as string },
    { key: 'subjectName', header: 'Materia', render: (row: AlumnoExamen) => row.subjectName as string },
    { key: 'cursoName', header: 'Curso', render: (row: AlumnoExamen) => row.cursoName as string },
    { key: 'condicion', header: 'Condición', render: (row: AlumnoExamen) => (
      <span style={{ color: row.condicion === 'LIBRE' ? 'var(--color-danger)' : 'var(--color-warning)', fontWeight: 600 }}>
        {row.condicion as string}
      </span>
    )},
    {
      key: 'nota',
      header: turno === 'DICIEMBRE' ? 'Nota Dic' : 'Nota Feb',
      render: (row: AlumnoExamen) => {
        const currentVal = turno === 'DICIEMBRE' ? row.notaDiciembre : row.notaFebrero;
        if (currentVal !== null && currentVal !== undefined) {
          return <span style={{ fontWeight: 600 }}>{String(currentVal)}</span>;
        }
        return (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              type="number"
              min="1"
              max="10"
              step="0.5"
              value={(notas[row.id] ?? '') as string}
              onChange={(e) => setNotas((prev) => ({ ...prev, [row.id]: e.target.value }))}
              style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              placeholder="1-10"
            />
            <Button
              variant="ghost"
              disabled={saving[row.id] || !notas[row.id]}
              onClick={() => handleRegistrarNota(row.id as string)}
              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
            >
              {saving[row.id] ? '...' : 'Guardar'}
            </Button>
          </div>
        );
      },
    },
    {
      key: 'definitiva',
      header: 'Definitiva',
      render: (row: AlumnoExamen) => {
        const def = definitivas[row.id] ?? row.definitiva;
        return (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {def !== null && def !== undefined ? (
              <span style={{ fontWeight: 700, color: (def as number) >= 6 ? 'var(--color-success)' : 'var(--color-danger)' }}>{String(def)}</span>
            ) : (
              <Button variant="ghost" onClick={() => handleCalcularDefinitiva(row.id as string)} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
                Calcular
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PremiumHeader
        title="Exámenes Suplementarios"
        icon="📝"
        subtitle="Registro de notas de exámenes Diciembre y Febrero"
        stats={[{ label: 'alumnos pendientes', value: String(data.length) }]}
      />

      <Card title="Filtros" className="mt-md">
        <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>Turno</label>
            <select
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '150px' }}
            >
              {TURNO_OPTS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <Input label="Año académico" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026" />
          <Button variant="ghost" onClick={buscar} disabled={loading} style={{ marginBottom: '0' }}>
            {loading ? 'Buscando...' : 'Buscar alumnos'}
          </Button>
        </div>
      </Card>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-md)' }}>
          {error}
        </div>
      )}

      {data.length > 0 && (
        <Card title={`Alumnos pendientes — ${turno} ${academicYear}`} className="mt-md">
          <Table columns={columns} data={data} emptyMessage="No se encontraron alumnos con exámenes pendientes" />
        </Card>
      )}

      {!loading && data.length === 0 && (
        <Card className="mt-md">
          <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: '2rem' }}>
            Seleccioná un turno y año académico, luego presioná "Buscar alumnos".
          </p>
        </Card>
      )}
    </div>
  );
}
