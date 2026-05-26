import { useState } from 'react';
import { useApiList, useApiDelete, useApiCreate } from '../../hooks/use-api';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

function GenericPage({ title, subtitle, url, columns, fields, extraParams }: {
  title: string; subtitle: string; url: string; columns: { key: string; header: string }[];
  fields: { name: string; label: string; type?: string; placeholder?: string }[];
  extraParams?: Record<string, string>;
}) {
  const { data, loading, reload } = useApiList<Record<string, string>>(url, extraParams);
  const { deleting, del } = useApiDelete(url);
  const { creating, createError, create } = useApiCreate(url);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const handleCreate = async () => {
    const body: Record<string, unknown> = {};
    fields.forEach(f => { if (form[f.name]) body[f.name] = form[f.name]; });
    const ok = await create(body as any);
    if (ok) { setShowForm(false); setForm({}); reload(); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nuevo'}</Button>
      </div>

      {showForm && (
        <Card title={`Nuevo ${title.toLowerCase()}`} className="mt-md">
          {createError && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{createError}</div>}
          <div className="flex flex-col gap-md">
            {fields.map(f => <Input key={f.name} label={f.label} type={f.type} value={form[f.name] ?? ''} onChange={e => setForm({...form, [f.name]: e.target.value})} placeholder={f.placeholder} />)}
            <Button onClick={handleCreate} loading={creating}>Crear</Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[...columns, { key: 'actions', header: '', render: (row) => <Button variant="ghost" size="sm" onClick={() => del(row.id).then(() => reload())} loading={deleting}>Eliminar</Button> }]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay datos'}
        />
      </Card>
    </div>
  );
}

export function SubjectsPage() { return <GenericPage title="Materias" subtitle="Asignaturas por nivel" url="/subjects" columns={[{key:'name',header:'Nombre'},{key:'level',header:'Nivel'}]} fields={[{name:'name',label:'Nombre'},{name:'level',label:'Nivel',placeholder:'INICIAL'},{name:'institutionId',label:'Institución ID'}]} />; }
export { default as CourseSectionsPage } from './course-sections';
export function SubjectAssignmentsPage() { return <GenericPage title="Asignaciones" subtitle="Docente ↔ Materia ↔ Curso" url="/subject-assignments" columns={[{key:'subjectId',header:'Materia'},{key:'teacherId',header:'Docente'},{key:'courseSectionId',header:'Curso'}]} fields={[{name:'subjectId',label:'Materia ID'},{name:'teacherId',label:'Docente ID'},{name:'courseSectionId',label:'Curso ID'}]} />; }
export function GradesPage() { return <GenericPage title="Calificaciones" subtitle="Notas por período" url="/grades" columns={[{key:'period',header:'Período'},{key:'numericValue',header:'Nota'},{key:'qualitativeValue',header:'Valoración'},{key:'status',header:'Estado'}]} fields={[{name:'studentId',label:'Estudiante ID'},{name:'subjectId',label:'Materia ID'},{name:'courseSectionId',label:'Curso ID'},{name:'period',label:'Período',placeholder:'1T'},{name:'numericValue',label:'Nota numérica',type:'number'},{name:'qualitativeValue',label:'Valoración cualitativa'},{name:'status',label:'Estado'}]} />; }
export function AttendancePage() { return <GenericPage title="Asistencia" subtitle="Registro diario" url="/attendance" columns={[{key:'studentId',header:'Estudiante'},{key:'status',header:'Estado'},{key:'date',header:'Fecha'}]} fields={[{name:'studentId',label:'Estudiante ID'},{name:'courseSectionId',label:'Curso ID'},{name:'date',label:'Fecha',type:'date'},{name:'status',label:'Estado',placeholder:'PRESENT'},{name:'note',label:'Nota'}]} />; }
