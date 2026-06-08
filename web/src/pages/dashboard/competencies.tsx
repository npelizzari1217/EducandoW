import { useState, useEffect } from 'react';
import { useApiCreate, useApiDelete, useApiUpdate } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import apiClient from '../../api/client';
import { PlanCourseSubjectSelector } from './components/PlanCourseSubjectSelector';
import { CopyCompetenciesDialog } from './components/CopyCompetenciesDialog';

// ── Types ─────────────────────────────────────────────────────────────────

interface Competency {
  [key: string]: unknown;
  id: string;
  studyPlanSubjectId: string;
  name: string;
}

interface CompetencyValuation {
  [key: string]: unknown;
  id: string;
  studentId: string;
  competencyId: string;
  competencyName?: string;
  valoracion1: string | null;
  valoracion2: string | null;
  valoracion3: string | null;
  valoracion4: string | null;
  modificable1: boolean;
  imprimible1: boolean;
  modificable2: boolean;
  imprimible2: boolean;
  modificable3: boolean;
  imprimible3: boolean;
  modificable4: boolean;
  imprimible4: boolean;
}

interface ValuationFormEntry {
  [key: string]: string | boolean;
  valoracion1: string;
  valoracion2: string;
  valoracion3: string;
  valoracion4: string;
  modificable1: boolean;
  imprimible1: boolean;
  modificable2: boolean;
  imprimible2: boolean;
  modificable3: boolean;
  imprimible3: boolean;
  modificable4: boolean;
  imprimible4: boolean;
}

// ── Confirm modal ──────────────────────────────────────────────────────────

function ConfirmModal({ title, message, onConfirm, onCancel }: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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

// ── Edit competency modal ──────────────────────────────────────────────────

function EditCompetencyModal({
  competency,
  onSave,
  onCancel,
  saving,
}: {
  competency: Competency;
  onSave: (id: string, data: { name: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(competency.name);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ maxWidth: 420, width: '90%' }}>
        <Card title="Editar competencia">
          <div className="flex flex-col gap-md">
            <Input label="Nombre" value={name} onChange={e => setName(e.target.value)} />
            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
              <Button variant="success-soft" onClick={() => onSave(competency.id, { name })} loading={saving}>Guardar</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── TAB 1: Competencias por Materia ───────────────────────────────────────

function CompetenciesTab({ studyPlanSubjectId }: { studyPlanSubjectId: string }) {
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const { creating, createError, create } = useApiCreate('/subject-competencies');

  const { deleting, del } = useApiDelete('/subject-competencies');
  const { updating, updateError, update } = useApiUpdate('/subject-competencies');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editCompetency, setEditCompetency] = useState<Competency | null>(null);

  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const loadCompetencies = async () => {
    if (!studyPlanSubjectId) { setCompetencies([]); return; }
    setLoading(true);
    setError('');
    try {
      const r = await apiClient.get('/subject-competencies', { params: { studyPlanSubjectId } });
      setCompetencies(r.data?.data ?? []);
    } catch { setError('Error al cargar competencias'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCompetencies(); }, [studyPlanSubjectId]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    const ok = await create({ studyPlanSubjectId, name: formName.trim() });
    if (ok) { setShowForm(false); setFormName(''); loadCompetencies(); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await del(deleteId);
    setDeleteId(null);
    loadCompetencies();
  };

  const handleEditSave = async (id: string, data: { name: string }) => {
    const ok = await update(id, data);
    if (ok) { setEditCompetency(null); loadCompetencies(); }
  };

  return (
    <div>
      {error && (
        <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
          {error}
        </div>
      )}

      {studyPlanSubjectId && (
        <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={() => setShowCopyDialog(true)}>
            Copiar desde otro curso
          </Button>
          <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => { setShowForm(!showForm); setError(''); }}>
            {showForm ? 'Cancelar' : 'Nueva competencia'}
          </Button>
        </div>
      )}

      {showForm && studyPlanSubjectId && (
        <Card title="Nueva competencia" className="mt-md">
          {createError && (
            <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
              {createError}
            </div>
          )}
          <div className="flex flex-col gap-md">
            <Input
              label="Nombre"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="Ej: Resuelve problemas de suma"
              required
            />
            <Button variant="success-soft" onClick={handleCreate} loading={creating}>Crear competencia</Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'name', header: 'Nombre' },
            {
              key: 'actions',
              header: '',
              render: (c: Competency) => (
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <Button variant="ghost" size="sm" onClick={() => setEditCompetency(c)}>Editar</Button>
                  <Button variant="danger-soft" size="sm" onClick={() => setDeleteId(c.id)} loading={deleting}>Eliminar</Button>
                </div>
              ),
            },
          ]}
          data={studyPlanSubjectId ? competencies : []}
          emptyMessage={
            loading
              ? 'Cargando...'
              : studyPlanSubjectId
              ? 'No hay competencias para esta materia'
              : 'Seleccioná un plan, curso y materia para ver las competencias'
          }
        />
      </Card>

      {deleteId && (
        <ConfirmModal
          title="Eliminar competencia"
          message="¿Estás seguro de eliminar esta competencia? Se perderán todas las valoraciones asociadas."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {editCompetency && (
        <EditCompetencyModal
          competency={editCompetency}
          onSave={handleEditSave}
          onCancel={() => setEditCompetency(null)}
          saving={updating}
        />
      )}

      {updateError && (
        <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
          {updateError}
        </div>
      )}

      {showCopyDialog && studyPlanSubjectId && (
        <CopyCompetenciesDialog
          targetStudyPlanSubjectId={studyPlanSubjectId}
          onSuccess={() => { setShowCopyDialog(false); loadCompetencies(); }}
          onClose={() => setShowCopyDialog(false)}
        />
      )}
    </div>
  );
}

// ── TAB 2: Valoraciones por Alumno ────────────────────────────────────────

function buildInitialForm(valuations: CompetencyValuation[]): Record<string, ValuationFormEntry> {
  const form: Record<string, ValuationFormEntry> = {};
  for (const v of valuations) {
    form[v.id] = {
      valoracion1: v.valoracion1 ?? '',
      valoracion2: v.valoracion2 ?? '',
      valoracion3: v.valoracion3 ?? '',
      valoracion4: v.valoracion4 ?? '',
      modificable1: v.modificable1 ?? false,
      imprimible1: v.imprimible1 ?? false,
      modificable2: v.modificable2 ?? false,
      imprimible2: v.imprimible2 ?? false,
      modificable3: v.modificable3 ?? false,
      imprimible3: v.imprimible3 ?? false,
      modificable4: v.modificable4 ?? false,
      imprimible4: v.imprimible4 ?? false,
    };
  }
  return form;
}

function ValuationsTab({ studyPlanSubjectId }: { studyPlanSubjectId: string }) {
  const [studentId, setStudentId] = useState('');
  const [valuations, setValuations] = useState<CompetencyValuation[]>([]);
  const [formState, setFormState] = useState<Record<string, ValuationFormEntry>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!studentId.trim() || !studyPlanSubjectId) {
      setError('Ingresá el ID del estudiante y seleccioná una materia');
      return;
    }
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const r = await apiClient.get('/competency-valuations', {
        params: { studentId: studentId.trim(), studyPlanSubjectId },
      });
      const data: CompetencyValuation[] = r.data?.data ?? [];
      setValuations(data);
      setFormState(buildInitialForm(data));
    } catch { setError('Error al cargar valoraciones'); setValuations([]); setFormState({}); }
    finally { setLoading(false); }
  };

  const hasChanges = (valuationId: string, original: CompetencyValuation): boolean => {
    const f = formState[valuationId];
    if (!f) return false;
    return (
      f.valoracion1 !== (original.valoracion1 ?? '') ||
      f.valoracion2 !== (original.valoracion2 ?? '') ||
      f.valoracion3 !== (original.valoracion3 ?? '') ||
      f.valoracion4 !== (original.valoracion4 ?? '') ||
      f.modificable1 !== (original.modificable1 ?? false) ||
      f.imprimible1 !== (original.imprimible1 ?? false) ||
      f.modificable2 !== (original.modificable2 ?? false) ||
      f.imprimible2 !== (original.imprimible2 ?? false) ||
      f.modificable3 !== (original.modificable3 ?? false) ||
      f.imprimible3 !== (original.imprimible3 ?? false) ||
      f.modificable4 !== (original.modificable4 ?? false) ||
      f.imprimible4 !== (original.imprimible4 ?? false)
    );
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError('');
    let successCount = 0;
    let failCount = 0;
    for (const original of valuations) {
      if (!hasChanges(original.id, original)) continue;
      const f = formState[original.id];
      try {
        await apiClient.patch(`/competency-valuations/${original.id}`, {
          valoracion1: f.valoracion1 || null,
          valoracion2: f.valoracion2 || null,
          valoracion3: f.valoracion3 || null,
          valoracion4: f.valoracion4 || null,
          modificable1: f.modificable1,
          imprimible1: f.imprimible1,
          modificable2: f.modificable2,
          imprimible2: f.imprimible2,
          modificable3: f.modificable3,
          imprimible3: f.imprimible3,
          modificable4: f.modificable4,
          imprimible4: f.imprimible4,
        });
        successCount++;
      } catch { failCount++; }
    }
    if (failCount > 0) setError(`Se guardaron ${successCount} cambios. ${failCount} fallaron.`);
    else if (successCount === 0) setError('No hay cambios para guardar');
    else { setError(''); handleSearch(); }
    setSaving(false);
  };

  const updateFormField = (valuationId: string, field: string, value: string | boolean) => {
    setFormState(prev => ({
      ...prev,
      [valuationId]: { ...prev[valuationId], [field]: value },
    }));
  };

  const PERIODS = [1, 2, 3, 4];

  return (
    <div>
      <Card className="mt-md">
        <Input
          id="student-id-input"
          label="ID del estudiante"
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          placeholder="Ej: 550e8400-e29b-..."
        />
        <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
          <Button variant="primary" onClick={handleSearch} loading={loading}>Buscar valoraciones</Button>
          {valuations.length > 0 && (
            <Button variant="success-soft" onClick={handleSaveAll} loading={saving}>Guardar todos los cambios</Button>
          )}
        </div>
      </Card>

      {error && (
        <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
          {error}
        </div>
      )}

      {searched && valuations.length === 0 && !loading && !error && (
        <Card className="mt-lg">
          <p style={{ color: 'var(--color-text-secondary)' }}>No se encontraron valoraciones para este estudiante y materia.</p>
        </Card>
      )}

      {valuations.length > 0 && (
        <Card className="mt-lg">
          <div className="table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap' }}>Competencia</th>
                  {PERIODS.map(p => (
                    <th key={p} style={{ textAlign: 'center', padding: '0.35rem 0.5rem', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}>
                      P{p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {valuations.map(v => {
                  const f = formState[v.id];
                  if (!f) return null;
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 500 }}>{v.competencyName || v.competencyId}</td>
                      {PERIODS.map(p => (
                        <td key={p} style={{ padding: '0.35rem 0.5rem', verticalAlign: 'top' }}>
                          <input
                            type="text"
                            value={f[`valoracion${p}`] as string}
                            onChange={e => updateFormField(v.id, `valoracion${p}`, e.target.value)}
                            placeholder={`P${p}`}
                            style={{ width: '80px', padding: '0.35rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: 'var(--text-sm)', textAlign: 'center' }}
                          />
                          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', fontSize: 'var(--text-xs)', alignItems: 'center', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <input
                                type="checkbox"
                                checked={f[`modificable${p}`] as boolean}
                                onChange={e => updateFormField(v.id, `modificable${p}`, e.target.checked)}
                                style={{ width: '14px', height: '14px' }}
                              />
                              M
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <input
                                type="checkbox"
                                checked={f[`imprimible${p}`] as boolean}
                                onChange={e => updateFormField(v.id, `imprimible${p}`, e.target.checked)}
                                style={{ width: '14px', height: '14px' }}
                              />
                              I
                            </label>
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function CompetenciesPage() {
  const [studyPlanSubjectId, setStudyPlanSubjectId] = useState('');
  const [activeTab, setActiveTab] = useState<'competencias' | 'valoraciones'>('competencias');

  return (
    <div>
      <PremiumHeader
        title="Competencias"
        subtitle="Gestión de competencias por materia y valoraciones por alumno"
        icon="🎯"
      />

      {/* Shared Plan→Course→Subject selector */}
      <Card className="mt-md">
        <PlanCourseSubjectSelector onSubjectSelect={setStudyPlanSubjectId} />
      </Card>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
        <Button
          variant={activeTab === 'competencias' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('competencias')}
        >
          Competencias por Materia
        </Button>
        <Button
          variant={activeTab === 'valoraciones' ? 'primary' : 'ghost'}
          onClick={() => setActiveTab('valoraciones')}
        >
          Valoraciones por Alumno
        </Button>
      </div>

      {activeTab === 'competencias'
        ? <CompetenciesTab studyPlanSubjectId={studyPlanSubjectId} />
        : <ValuationsTab studyPlanSubjectId={studyPlanSubjectId} />}
    </div>
  );
}
