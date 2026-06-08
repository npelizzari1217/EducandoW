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

// ── Main Page ──────────────────────────────────────────────────────────────

export function CompetenciesPage() {
  const [studyPlanSubjectId, setStudyPlanSubjectId] = useState('');

  return (
    <div>
      <PremiumHeader
        title="Competencias"
        subtitle="Gestión de competencias por materia"
        icon="🎯"
      />

      {/* Shared Plan→Course→Subject selector */}
      <Card className="mt-md">
        <PlanCourseSubjectSelector onSubjectSelect={setStudyPlanSubjectId} />
      </Card>

      <CompetenciesTab studyPlanSubjectId={studyPlanSubjectId} />
    </div>
  );
}
