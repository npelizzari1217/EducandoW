import { useState, useEffect } from 'react';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiDelete, useApiCreate, extractErrorMessage } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import apiClient from '../../api/client';

// ── Shared types ────────────────────────────────────────────

interface Assignment {
  [key: string]: unknown;
  id: string;
  subjectId: string;
  teacherId: string;
  courseSectionId: string;
}

interface Evaluacion {
  [key: string]: unknown;
  id: string;
  title: string;
  evaluationDate: string;
  weight: number;
}

interface Nota {
  [key: string]: unknown;
  id: string;
  studentId: string;
  numericValue: number | null;
  qualitativeValue: string | null;
  comments: string | null;
  gradeCode: string | null;
  gradeLabel: string | null;
  isApproved: boolean | null;
}

interface Periodo {
  [key: string]: unknown;
  id: string;
  name: string;
  academicYear: string;
  startDate: string;
  endDate: string;
}

interface NotaTrimestral {
  [key: string]: unknown;
  id: string;
  studentId: string;
  assignmentId: string;
  periodId: string;
  finalGrade: number;
  attendancePct: number | null;
}

interface StudentSummary {
  [key: string]: unknown;
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  fullName: string;
}

// ── Helper: confirmation modal ──────────────────────────────

function ConfirmModal({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ maxWidth: 400, width: '90%' }}>
        <Card title={title}>
          <p style={{ marginBottom: 'var(--space-md)' }}>{message}</p>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
            <Button variant="danger-soft" onClick={onConfirm}>Confirmar</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── EvaluacionesPage ────────────────────────────────────────

export function EvaluacionesPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', evaluationDate: '', description: '', weight: '1' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/subject-assignments').then(r => {
      setAssignments(r.data?.data ?? []);
    }).catch(() => {});
  }, []);

  const loadEvaluaciones = async () => {
    if (!selectedAssignmentId) return;
    setLoading(true);
    try {
      const r = await apiClient.get('/evaluaciones', { params: { assignmentId: selectedAssignmentId } });
      setEvaluaciones(r.data?.data ?? []);
    } catch { setError('Error al cargar evaluaciones'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadEvaluaciones(); }, [selectedAssignmentId]);

  const handleCreate = async () => {
    if (!form.title.trim()) { setError('El título es requerido'); return; }
    if (!form.evaluationDate) { setError('La fecha es requerida'); return; }
    setCreating(true); setError('');
    try {
      await apiClient.post('/evaluaciones', {
        assignmentId: selectedAssignmentId,
        title: form.title,
        evaluationDate: new Date(form.evaluationDate).toISOString(),
        description: form.description || undefined,
        weight: parseFloat(form.weight) || 1,
      });
      setShowForm(false);
      setForm({ title: '', evaluationDate: '', description: '', weight: '1' });
      loadEvaluaciones();
    } catch (e: unknown) { setError(extractErrorMessage(e)); }
    finally { setCreating(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await apiClient.delete(`/evaluaciones/${deleteId}`); setDeleteId(null); loadEvaluaciones(); }
    catch (e: unknown) { setError(extractErrorMessage(e)); setDeleteId(null); }
  };

  return (
    <div>
      <PremiumHeader title="Evaluaciones" subtitle="Exámenes, trabajos prácticos y evaluaciones por asignación" icon="📝"
        stats={[{ label: 'evaluaciones', value: String(evaluaciones.length) }]}>
        {selectedAssignmentId && <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => { setShowForm(!showForm); setError(''); }}>{showForm ? 'Cancelar' : 'Nueva evaluación'}</Button>}
      </PremiumHeader>

      <Card className="mt-md">
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>Asignación docente</label>
        <select value={selectedAssignmentId} onChange={e => setSelectedAssignmentId(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', width: '100%' }}>
          <option value="">Seleccionar asignación...</option>
          {assignments.map(a => <option key={a.id} value={a.id}>{a.subjectId} — {a.teacherId} — {a.courseSectionId}</option>)}
        </select>
      </Card>

      {error && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{error}</div>}

      {showForm && selectedAssignmentId && (
        <Card title="Nueva evaluación" className="mt-md">
          <div className="flex flex-col gap-md">
            <Input label="Título" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
            <Input label="Fecha" type="datetime-local" value={form.evaluationDate} onChange={e => setForm({...form, evaluationDate: e.target.value})} required />
            <Input label="Descripción (opcional)" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            <Input label="Peso" type="number" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} />
            <Button variant="success-soft" onClick={handleCreate} loading={creating}>Crear evaluación</Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'title', header: 'Título' },
            { key: 'evaluationDate', header: 'Fecha', render: (e: Evaluacion) => new Date(e.evaluationDate).toLocaleDateString('es-AR') },
            { key: 'weight', header: 'Peso' },
            { key: 'actions', header: '', render: (e: Evaluacion) => <Button variant="danger-soft" size="sm" onClick={() => setDeleteId(e.id)}>Eliminar</Button> },
          ]}
          data={selectedAssignmentId ? evaluaciones : []}
          emptyMessage={loading ? 'Cargando...' : selectedAssignmentId ? 'No hay evaluaciones' : 'Seleccioná una asignación para ver las evaluaciones'}
        />
      </Card>

      {deleteId && <ConfirmModal title="Eliminar evaluación" message="¿Estás seguro de eliminar esta evaluación? Se perderán todas las notas asociadas." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}

// ── NotasPage ────────────────────────────────────────────────

export function NotasPage() {
  const { config } = useInstitution();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [selectedEvaluacionId, setSelectedEvaluacionId] = useState('');
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [gradeForm, setGradeForm] = useState<Record<string, { numericValue: string; qualitativeValue: string }>>({});

  useEffect(() => {
    apiClient.get('/subject-assignments').then(r => setAssignments(r.data?.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedAssignmentId) return;
    apiClient.get('/evaluaciones', { params: { assignmentId: selectedAssignmentId } }).then(r => setEvaluaciones(r.data?.data ?? [])).catch(() => {});
    apiClient.get('/students', { params: { institutionId: config.id } }).then(r => setStudents(r.data?.data ?? [])).catch(() => {});
  }, [selectedAssignmentId]);

  const loadNotas = async () => {
    if (!selectedEvaluacionId) return;
    setLoading(true);
    try {
      const r = await apiClient.get('/notas', { params: { evaluationId: selectedEvaluacionId } });
      const notasList: Nota[] = r.data?.data ?? [];
      setNotas(notasList);
      const form: Record<string, { numericValue: string; qualitativeValue: string }> = {};
      for (const n of notasList) {
        form[n.studentId] = {
          numericValue: n.numericValue != null ? String(n.numericValue) : '',
          qualitativeValue: n.qualitativeValue ?? '',
        };
      }
      setGradeForm(form);
    } catch { setError('Error al cargar notas'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadNotas(); }, [selectedEvaluacionId]);

  const handleSaveNota = async (studentId: string) => {
    const entry = gradeForm[studentId];
    if (!entry) return;
    if (!entry.numericValue && !entry.qualitativeValue) { setError('Ingresá un valor numérico o cualitativo'); return; }
    setSaving(true); setError('');
    try {
      const existing = notas.find(n => n.studentId === studentId);
      if (existing) {
        // Update via PATCH if available (using POST as upsert)
        await apiClient.post('/notas', {
          evaluationId: selectedEvaluacionId,
          studentId,
          numericValue: entry.numericValue ? parseFloat(entry.numericValue) : undefined,
          qualitativeValue: entry.qualitativeValue || undefined,
        });
      } else {
        await apiClient.post('/notas', {
          evaluationId: selectedEvaluacionId,
          studentId,
          numericValue: entry.numericValue ? parseFloat(entry.numericValue) : undefined,
          qualitativeValue: entry.qualitativeValue || undefined,
        });
      }
      loadNotas();
    } catch (e: unknown) { setError(extractErrorMessage(e)); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PremiumHeader title="Notas" subtitle="Ingreso de calificaciones por evaluación" icon="📊" stats={[{ label: 'notas', value: String(notas.length) }]} />

      <Card className="mt-md">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Asignación docente</label>
            <select value={selectedAssignmentId} onChange={e => { setSelectedAssignmentId(e.target.value); setSelectedEvaluacionId(''); }}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', width: '100%' }}>
              <option value="">Seleccionar asignación...</option>
              {assignments.map(a => <option key={a.id} value={a.id}>{a.subjectId} — Curso {a.courseSectionId}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Evaluación</label>
            <select value={selectedEvaluacionId} onChange={e => setSelectedEvaluacionId(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', width: '100%' }}>
              <option value="">Seleccionar evaluación...</option>
              {evaluaciones.map(ev => <option key={ev.id} value={ev.id}>{ev.title} ({new Date(ev.evaluationDate).toLocaleDateString('es-AR')})</option>)}
            </select>
          </div>
        </div>
      </Card>

      {error && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{error}</div>}

      {selectedEvaluacionId && (
        <Card className="mt-lg">
          {loading ? <p>Cargando notas...</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--color-border)' }}>Alumno</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--color-border)' }}>DNI</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--color-border)' }}>Nota numérica</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--color-border)' }}>Valoración</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--color-border)' }}>Actual</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--color-border)' }}>Guardar</th>
                </tr>
              </thead>
              <tbody>
                {students.map(st => {
                  const nota = notas.find(n => n.studentId === st.id);
                  const form = gradeForm[st.id] || { numericValue: '', qualitativeValue: '' };
                  return (
                    <tr key={st.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.5rem' }}>{st.fullName || `${st.lastName}, ${st.firstName}`}</td>
                      <td style={{ padding: '0.5rem', fontSize: 'var(--text-sm)' }}>{st.dni}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <input type="number" step="0.1" value={form.numericValue}
                          onChange={e => setGradeForm({...gradeForm, [st.id]: {...form, numericValue: e.target.value}})}
                          style={{ width: '80px', padding: '0.35rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: 'var(--text-sm)' }} />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <input type="text" value={form.qualitativeValue}
                          onChange={e => setGradeForm({...gradeForm, [st.id]: {...form, qualitativeValue: e.target.value}})}
                          placeholder="Ej: Excelente"
                          style={{ width: '140px', padding: '0.35rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: 'var(--text-sm)' }} />
                      </td>
                      <td style={{ padding: '0.5rem', fontSize: 'var(--text-sm)' }}>
                        {nota ? (nota.gradeLabel || nota.numericValue || nota.qualitativeValue || '—') : '—'}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <Button variant="success-soft" size="sm" onClick={() => handleSaveNota(st.id)} loading={saving}>Guardar</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}

// ── PeriodosPage ─────────────────────────────────────────────

export function PeriodosPage() {
  const { data, loading, reload } = useApiList<Periodo>('/periodos', { academicYear: String(new Date().getFullYear()) });
  const { deleting, del } = useApiDelete('/periodos');
  const { creating, createError, create } = useApiCreate('/periodos');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', academicYear: String(new Date().getFullYear()) });

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    const body = {
      name: form.name,
      academicYear: form.academicYear,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
    };
    const ok = await create(body);
    if (ok) { setShowForm(false); setForm({ name: '', startDate: '', endDate: '', academicYear: form.academicYear }); reload(); }
  };

  return (
    <div>
      <PremiumHeader title="Períodos de Evaluación" subtitle="Trimestres, bimestres o períodos personalizados" icon="📅"
        stats={[{ label: 'períodos', value: String(data.length) }]}>
        <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nuevo período'}</Button>
      </PremiumHeader>

      {showForm && (
        <Card title="Nuevo período" className="mt-md">
          {createError && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{createError}</div>}
          <div className="flex flex-col gap-md">
            <Input label="Nombre" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Primer Trimestre" required />
            <Input label="Año lectivo" value={form.academicYear} onChange={e => setForm({...form, academicYear: e.target.value})} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input label="Fecha inicio" type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} required />
              <Input label="Fecha fin" type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} required />
            </div>
            <Button variant="success-soft" onClick={handleCreate} loading={creating}>Crear período</Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'name', header: 'Nombre' },
            { key: 'academicYear', header: 'Año' },
            { key: 'startDate', header: 'Inicio', render: (p: Periodo) => new Date(p.startDate).toLocaleDateString('es-AR') },
            { key: 'endDate', header: 'Fin', render: (p: Periodo) => new Date(p.endDate).toLocaleDateString('es-AR') },
            { key: 'actions', header: '', render: (p: Periodo) => <Button variant="danger-soft" size="sm" onClick={() => del(p.id).then(() => reload())} loading={deleting}>Eliminar</Button> },
          ]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay períodos'}
        />
      </Card>
    </div>
  );
}

// ── NotasTrimestralesPage ────────────────────────────────────

export function NotasTrimestralesPage() {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [notasTrimestrales, setNotasTrimestrales] = useState<NotaTrimestral[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', assignmentId: '', finalGrade: '', attendancePct: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiClient.get('/periodos', { params: { academicYear: String(new Date().getFullYear()) } }).then(r => setPeriodos(r.data?.data ?? [])).catch(() => {});
  }, []);

  const loadNotas = async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    try {
      const r = await apiClient.get('/notas-trimestrales', { params: { periodId: selectedPeriodId } });
      setNotasTrimestrales(r.data?.data ?? []);
    } catch { setError('Error al cargar notas trimestrales'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadNotas(); }, [selectedPeriodId]);

  const handleCreate = async () => {
    if (!form.studentId.trim() || !form.assignmentId.trim() || !form.finalGrade) { setError('Completá todos los campos requeridos'); return; }
    setCreating(true); setError('');
    try {
      await apiClient.post('/notas-trimestrales', {
        studentId: form.studentId,
        assignmentId: form.assignmentId,
        periodId: selectedPeriodId,
        finalGrade: parseFloat(form.finalGrade),
        attendancePct: form.attendancePct ? parseFloat(form.attendancePct) : undefined,
      });
      setShowForm(false);
      setForm({ studentId: '', assignmentId: '', finalGrade: '', attendancePct: '' });
      loadNotas();
    } catch (e: unknown) { setError(extractErrorMessage(e)); }
    finally { setCreating(false); }
  };

  return (
    <div>
      <PremiumHeader title="Notas Trimestrales" subtitle="Calificaciones consolidadas por período" icon="📈"
        stats={[{ label: 'notas', value: String(notasTrimestrales.length) }]}>
        {selectedPeriodId && <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nueva nota trimestral'}</Button>}
      </PremiumHeader>

      <Card className="mt-md">
        <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>Período</label>
        <select value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', width: '100%' }}>
          <option value="">Seleccionar período...</option>
          {periodos.map(p => <option key={p.id} value={p.id}>{p.name} ({p.academicYear})</option>)}
        </select>
      </Card>

      {error && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{error}</div>}

      {showForm && selectedPeriodId && (
        <Card title="Nueva nota trimestral" className="mt-md">
          <div className="flex flex-col gap-md">
            <Input label="ID del estudiante" value={form.studentId} onChange={e => setForm({...form, studentId: e.target.value})} required />
            <Input label="ID de asignación" value={form.assignmentId} onChange={e => setForm({...form, assignmentId: e.target.value})} required />
            <Input label="Nota final" type="number" step="0.1" value={form.finalGrade} onChange={e => setForm({...form, finalGrade: e.target.value})} required />
            <Input label="% Asistencia (opcional)" type="number" step="0.1" value={form.attendancePct} onChange={e => setForm({...form, attendancePct: e.target.value})} />
            <Button variant="success-soft" onClick={handleCreate} loading={creating}>Crear nota trimestral</Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'studentId', header: 'Estudiante' },
            { key: 'assignmentId', header: 'Asignación' },
            { key: 'finalGrade', header: 'Nota final' },
            { key: 'attendancePct', header: '% Asistencia', render: (n: NotaTrimestral) => n.attendancePct != null ? `${n.attendancePct}%` : '—' },
          ]}
          data={selectedPeriodId ? notasTrimestrales : []}
          emptyMessage={loading ? 'Cargando...' : selectedPeriodId ? 'No hay notas trimestrales' : 'Seleccioná un período'}
        />
      </Card>
    </div>
  );
}
