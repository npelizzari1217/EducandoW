import { useState, useEffect } from 'react';
import { useApiCreate, useApiDelete, useApiUpdate } from '../../../hooks/use-api';
import { Button } from '../../../components/ui/button';
import apiClient from '../../../api/client';
import { CopyCompetenciesDialog } from './CopyCompetenciesDialog';

// ── Types ─────────────────────────────────────────────────────────────────

interface Competency {
  [key: string]: unknown;
  id: string;
  studyPlanSubjectId: string;
  name: string;
}

// ── Subject Competencies Manager ────────────────────────────────────────────
// Inline competency CRUD for a single study-plan subject. Rendered as the 4th
// accordion level inside Study Plans (Plan → Curso → Materia → Competencia),
// reusing the same course→subject visual pattern (course-subjects / subject-item).

export function SubjectCompetenciesManager({ studyPlanSubjectId, institutionId }: { studyPlanSubjectId: string; institutionId?: string }) {
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Multi-tenant: every call must carry the institutionId query param.
  const tenantQueryParams = institutionId ? { institutionId } : undefined;

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const { creating, createError, create } = useApiCreate('/subject-competencies', tenantQueryParams);

  const { del } = useApiDelete('/subject-competencies', tenantQueryParams);
  const { update } = useApiUpdate('/subject-competencies', tenantQueryParams);
  const [editing, setEditing] = useState<{ id: string | null; name: string }>({ id: null, name: '' });

  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const loadCompetencies = async () => {
    if (!studyPlanSubjectId) { setCompetencies([]); return; }
    setLoading(true);
    setError('');
    try {
      const r = await apiClient.get('/subject-competencies', { params: { studyPlanSubjectId, ...(institutionId ? { institutionId } : {}) } });
      setCompetencies(r.data?.data ?? []);
    } catch { setError('Error al cargar competencias'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCompetencies(); }, [studyPlanSubjectId, institutionId]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    const ok = await create({ studyPlanSubjectId, name: formName.trim() });
    if (ok) { setShowForm(false); setFormName(''); loadCompetencies(); }
  };

  const handleSaveEdit = async () => {
    if (!editing.id || !editing.name.trim()) return;
    const ok = await update(editing.id, { name: editing.name.trim() });
    if (ok) { setEditing({ id: null, name: '' }); loadCompetencies(); }
  };

  const handleDelete = async (id: string) => {
    await del(id);
    loadCompetencies();
  };

  return (
    <div className="course-subjects">
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Competencias</span>
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          <Button variant="action" size="sm" onClick={() => setShowCopyDialog(true)}>Copiar</Button>
          <Button
            variant={showForm ? 'danger-soft' : 'success-soft'}
            size="sm"
            onClick={() => { setShowForm(!showForm); setFormName(''); setError(''); }}
          >
            {showForm ? 'Cancelar' : '+ Nueva'}
          </Button>
        </div>
      </div>

      {/* Form: nueva competencia */}
      {showForm && (
        <div className="inline-form no-print" style={{ marginBottom: '0.5rem' }}>
          <div className="inline-form-row">
            <div style={{ flex: 1 }}>
              <label>Nombre</label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Ej: Resuelve problemas de suma"
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              />
            </div>
            <Button variant="success-soft" size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creando...' : 'Crear'}
            </Button>
          </div>
          {createError && (
            <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.35rem' }}>{createError}</div>
          )}
        </div>
      )}

      {error && (
        <div style={{ color: '#dc2626', fontSize: '0.75rem', marginBottom: '0.35rem' }}>{error}</div>
      )}

      {loading ? (
        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Cargando...</p>
      ) : competencies.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sin competencias.</p>
      ) : (
        competencies.map((c: Competency) => {
          const isEditing = editing.id === c.id;
          return (
            <div key={c.id} className="subject-item">
              {isEditing ? (
                <div className="edit-inline-row no-print" style={{ flex: 1 }}>
                  <input
                    value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    style={{ flex: 1 }}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); }}
                  />
                  <Button variant="success-soft" size="sm" onClick={handleSaveEdit}>Guardar</Button>
                  <Button variant="danger-soft" size="sm" onClick={() => setEditing({ id: null, name: '' })}>Cancelar</Button>
                </div>
              ) : (
                <>
                  <span>{c.name}</span>
                  <div className="subject-actions no-print">
                    <Button variant="action" size="sm" onClick={() => setEditing({ id: c.id, name: c.name })}>Editar</Button>
                    <Button variant="danger-soft" size="sm" onClick={() => handleDelete(c.id)}>Eliminar</Button>
                  </div>
                </>
              )}
            </div>
          );
        })
      )}

      {showCopyDialog && (
        <CopyCompetenciesDialog
          targetStudyPlanSubjectId={studyPlanSubjectId}
          institutionId={institutionId}
          onSuccess={() => { setShowCopyDialog(false); loadCompetencies(); }}
          onClose={() => setShowCopyDialog(false)}
        />
      )}
    </div>
  );
}
