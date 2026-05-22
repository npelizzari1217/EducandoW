import { useState } from 'react';
import { useAuth } from '../../context/auth-context';
import { useApiList, useApiDelete, useApiCreate } from '../../hooks/use-api';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

export default function EnrollmentsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ studentId: '', institutionId: user?.institutionId ?? '' });
  const params: Record<string, string> | undefined = filters.studentId ? { studentId: filters.studentId } : filters.institutionId ? { institutionId: filters.institutionId } : undefined;
  const { data, loading, reload } = useApiList<Record<string, string>>('/enrollments', params);
  const { deleting, del } = useApiDelete('/enrollments');
  const { creating, createError, create } = useApiCreate('/enrollments');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', institutionId: filters.institutionId, level: 'INICIAL', academicYear: String(new Date().getFullYear()), grade: '', division: '' });

  const handleCreate = async () => {
    const ok = await create({ ...form, grade: form.grade || undefined, division: form.division || undefined });
    if (ok) { setShowForm(false); reload(); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Inscripciones</h1></div>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nueva inscripción'}</Button>
      </div>

      <div className="flex gap-md items-center" style={{ marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <Input label="Estudiante ID" value={filters.studentId} onChange={e => setFilters({...filters, studentId: e.target.value})} placeholder="UUID" />
        <Input label="Institución ID" value={filters.institutionId} onChange={e => setFilters({...filters, institutionId: e.target.value})} placeholder="UUID" />
        <Button variant="ghost" onClick={reload} style={{ marginTop: '1.25rem' }}>Buscar</Button>
      </div>

      {showForm && (
        <Card title="Nueva inscripción" className="mt-md">
          {createError && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{createError}</div>}
          <div className="flex flex-col gap-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input label="Estudiante ID" value={form.studentId} onChange={e => setForm({...form, studentId: e.target.value})} required />
              <Input label="Institución ID" value={form.institutionId} onChange={e => setForm({...form, institutionId: e.target.value})} required />
            </div>
            <div className="field"><label className="field-label">Nivel</label><select className="input" value={form.level} onChange={e => setForm({...form, level: e.target.value})}>{['INICIAL','PRIMARIO','SECUNDARIO','TERCIARIO'].map(l => <option key={l} value={l}>{l}</option>)}</select></div>
            <Input label="Año lectivo" value={form.academicYear} onChange={e => setForm({...form, academicYear: e.target.value})} required />
            <Input label="Grado" value={form.grade} onChange={e => setForm({...form, grade: e.target.value})} />
            <Input label="División" value={form.division} onChange={e => setForm({...form, division: e.target.value})} />
            <Button onClick={handleCreate} loading={creating}>Inscribir</Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[{ key: 'level', header: 'Nivel' }, { key: 'academicYear', header: 'Año' }, { key: 'grade', header: 'Grado' }, { key: 'division', header: 'Div' }, { key: 'status', header: 'Estado' }, { key: 'actions', header: '', render: (e) => <Button variant="ghost" size="sm" onClick={() => del(e.id).then(() => reload())} loading={deleting}>Eliminar</Button> }]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay inscripciones'}
        />
      </Card>
    </div>
  );
}
