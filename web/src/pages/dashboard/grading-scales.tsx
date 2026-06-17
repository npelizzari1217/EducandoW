import { useState, useCallback, useEffect } from 'react';
import { useCan } from '../../hooks/use-can';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiDelete, extractErrorMessage } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import apiClient from '../../api/client';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { buildBranding } from '../../components/reports/PremiumPrintReport';
import ScalePrintView from '../../components/reports/ScalePrintView';

// ── Constants ──────────────────────────────────────────────

const LEVEL_OPTIONS = [
  { value: 1, label: 'Inicial' },
  { value: 2, label: 'Primario' },
  { value: 3, label: 'Secundario' },
  { value: 4, label: 'Terciario' },
];

const MODALITY_OPTIONS = [
  { value: 0, label: 'General' },
  { value: 1, label: 'Técnico' },
  { value: 2, label: 'Especial' },
];

const INTERNAL_STATUS_OPTIONS = [
  { value: 'APROBADO', label: 'Aprobado' },
  { value: 'NO_APROBADO', label: 'No aprobado' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'LIBRE', label: 'Libre' },
];

const LEVEL_LABELS: Record<number, string> = {
  1: 'Inicial',
  2: 'Primario',
  3: 'Secundario',
  4: 'Terciario',
};

const MODALITY_LABELS: Record<number, string> = {
  0: 'General',
  1: 'Técnico',
  2: 'Especial',
};

const INTERNAL_STATUS_LABELS: Record<string, string> = {
  APROBADO: 'Aprobado',
  NO_APROBADO: 'No aprobado',
  EN_PROCESO: 'En proceso',
  LIBRE: 'Libre',
};

// ── Types ──────────────────────────────────────────────────

interface Institution { id: string; name: string; }

interface GradeScaleValueRow {
  id: string;
  scale_id: string;
  code: string;
  label: string;
  internal_status: string;
  sort_order: number;
  active: boolean;
}

interface GradeScaleRow {
  id: string;
  name: string;
  level: number;
  modality: number;
  active: boolean;
  values: GradeScaleValueRow[];
}

interface ScaleForm {
  name: string;
  level: number;
  modality: number;
}

interface ValueForm {
  code: string;
  label: string;
  internalStatus: string;
  sortOrder: string;
}

type ScaleFieldErrors = Partial<Record<keyof ScaleForm, string>>;
type ValueFieldErrors = Partial<Record<keyof ValueForm, string>>;

const EMPTY_SCALE_FORM: ScaleForm = { name: '', level: 2, modality: 0 };
const EMPTY_VALUE_FORM: ValueForm = { code: '', label: '', internalStatus: 'APROBADO', sortOrder: '0' };

// ── Page component ─────────────────────────────────────────

export default function GradingScalesPage() {
  const { can: hasModuleAction, isRoot } = useCan();
  const { config } = useInstitution();

  // ROOT institution selector
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState(isRoot ? (config.id ?? '') : '');

  useEffect(() => {
    if (!isRoot) return;
    apiClient.get('/institutions').then(r => {
      setInstitutions(r.data?.data ?? []);
    }).catch(() => {});
  }, [isRoot]);

  // API query params: ROOT passes institutionId when selected
  const rootQueryParams = (isRoot && institutionId) ? { institutionId } : undefined;

  // List URL: skip fetch when ROOT has not yet selected an institution
  const listUrl = (isRoot && !institutionId) ? '' : '/grading/scales';

  const { data, loading, reload } = useApiList<GradeScaleRow>(listUrl, rootQueryParams);
  const { deleting: deletingScale, del: delScale } = useApiDelete('/grading/scales', rootQueryParams);

  // Filters
  const [filterLevel, setFilterLevel] = useState('');
  const [filterModality, setFilterModality] = useState('');

  // Scale form state
  const [showScaleForm, setShowScaleForm] = useState(false);
  const [scaleForm, setScaleForm] = useState<ScaleForm>(EMPTY_SCALE_FORM);
  const [editingScaleId, setEditingScaleId] = useState<string | null>(null);
  const [scaleSaving, setScaleSaving] = useState(false);
  const [scaleSaveError, setScaleSaveError] = useState('');
  const [scaleFieldErrors, setScaleFieldErrors] = useState<ScaleFieldErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<GradeScaleRow | null>(null);

  // Selected scale ID (derive selectedScale from data to stay fresh on reload)
  const [selectedScaleId, setSelectedScaleId] = useState<string | null>(null);
  const selectedScale = data.find(s => s.id === selectedScaleId) ?? null;

  // Print view
  const [showPrint, setShowPrint] = useState(false);

  // Value form state
  const [showValueForm, setShowValueForm] = useState(false);
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [valueForm, setValueForm] = useState<ValueForm>(EMPTY_VALUE_FORM);
  const [valueSaving, setValueSaving] = useState(false);
  const [valueSaveError, setValueSaveError] = useState('');
  const [valueFieldErrors, setValueFieldErrors] = useState<ValueFieldErrors>({});
  const [deleteValueTarget, setDeleteValueTarget] = useState<GradeScaleValueRow | null>(null);
  const [deletingValue, setDeletingValue] = useState(false);

  // ── Scale form helpers ─────────────────────────────────

  const updateScaleField = (field: keyof ScaleForm, value: string | number) => {
    setScaleForm(f => ({ ...f, [field]: value }));
    if (scaleFieldErrors[field]) {
      setScaleFieldErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const validateScaleForm = useCallback((): boolean => {
    const errs: ScaleFieldErrors = {};
    if (!scaleForm.name.trim()) errs.name = 'El nombre es obligatorio';
    setScaleFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [scaleForm]);

  const clearScaleForm = () => {
    setShowScaleForm(false);
    setScaleForm(EMPTY_SCALE_FORM);
    setEditingScaleId(null);
    setScaleSaveError('');
    setScaleFieldErrors({});
  };

  const handleCreateScale = async () => {
    if (!validateScaleForm()) return;
    setScaleSaving(true); setScaleSaveError('');
    try {
      await apiClient.post('/grading/scales', {
        name: scaleForm.name.trim(),
        level: scaleForm.level,
        modality: scaleForm.modality,
      }, { params: rootQueryParams });
      clearScaleForm();
      reload();
    } catch (e: unknown) {
      setScaleSaveError(extractErrorMessage(e) || 'Error al crear escala');
    } finally {
      setScaleSaving(false);
    }
  };

  const handleEditScale = (row: GradeScaleRow) => {
    setEditingScaleId(row.id);
    setScaleForm({ name: row.name, level: row.level, modality: row.modality });
    setScaleSaveError('');
    setScaleFieldErrors({});
    setShowScaleForm(true);
  };

  const handleSaveScale = async () => {
    if (!editingScaleId) return;
    if (!validateScaleForm()) return;
    setScaleSaving(true); setScaleSaveError('');
    try {
      await apiClient.patch(`/grading/scales/${editingScaleId}`, {
        name: scaleForm.name.trim(),
      }, { params: rootQueryParams });
      clearScaleForm();
      reload();
    } catch (e: unknown) {
      setScaleSaveError(extractErrorMessage(e) || 'Error al guardar');
    } finally {
      setScaleSaving(false);
    }
  };

  const handleDeleteScaleConfirm = async () => {
    if (!deleteTarget) return;
    const success = await delScale(deleteTarget.id);
    setDeleteTarget(null);
    if (success) {
      if (selectedScaleId === deleteTarget.id) setSelectedScaleId(null);
      reload();
    } else {
      alert('Error al eliminar. Intentá de nuevo.');
    }
  };

  // ── Value form helpers ─────────────────────────────────

  const updateValueField = (field: keyof ValueForm, value: string) => {
    setValueForm(f => ({ ...f, [field]: value }));
    if (valueFieldErrors[field]) {
      setValueFieldErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const validateValueForm = useCallback((): boolean => {
    const errs: ValueFieldErrors = {};
    if (!valueForm.code.trim()) errs.code = 'El código es obligatorio';
    if (!valueForm.label.trim()) errs.label = 'La etiqueta es obligatoria';
    if (!valueForm.internalStatus) errs.internalStatus = 'El estado interno es obligatorio';
    setValueFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [valueForm]);

  const clearValueForm = () => {
    setShowValueForm(false);
    setEditingValueId(null);
    setValueForm(EMPTY_VALUE_FORM);
    setValueFieldErrors({});
    setValueSaveError('');
  };

  const handleEditValue = (v: GradeScaleValueRow) => {
    setEditingValueId(v.id);
    setValueForm({
      code: v.code,
      label: v.label,
      internalStatus: v.internal_status,
      sortOrder: String(v.sort_order),
    });
    setValueFieldErrors({});
    setValueSaveError('');
    setShowValueForm(true);
  };

  const handleSaveValue = async () => {
    if (!selectedScale) return;
    if (!validateValueForm()) return;
    setValueSaving(true); setValueSaveError('');
    try {
      if (editingValueId) {
        // code is immutable on the server — send only mutable fields
        await apiClient.patch(`/grading/scales/${selectedScale.id}/values/${editingValueId}`, {
          label: valueForm.label.trim(),
          internalStatus: valueForm.internalStatus,
          sortOrder: Number(valueForm.sortOrder),
        }, { params: rootQueryParams });
      } else {
        await apiClient.post(`/grading/scales/${selectedScale.id}/values`, {
          code: valueForm.code.trim(),
          label: valueForm.label.trim(),
          internalStatus: valueForm.internalStatus,
          sortOrder: Number(valueForm.sortOrder),
        }, { params: rootQueryParams });
      }
      clearValueForm();
      reload();
    } catch (e: unknown) {
      setValueSaveError(extractErrorMessage(e) || (editingValueId ? 'Error al guardar valor' : 'Error al crear valor'));
    } finally {
      setValueSaving(false);
    }
  };

  const handleDeleteValueConfirm = async () => {
    if (!deleteValueTarget || !selectedScale) return;
    setDeletingValue(true);
    try {
      await apiClient.delete(
        `/grading/scales/${selectedScale.id}/values/${deleteValueTarget.id}`,
        rootQueryParams ? { params: rootQueryParams } : undefined,
      );
      setDeleteValueTarget(null);
      reload();
    } catch {
      alert('Error al eliminar valor. Intentá de nuevo.');
    } finally {
      setDeletingValue(false);
    }
  };

  // ── Filtered data ──────────────────────────────────────

  const filteredData = data.filter(row => {
    if (filterLevel && row.level !== Number(filterLevel)) return false;
    if (filterModality !== '' && row.modality !== Number(filterModality)) return false;
    return true;
  });

  // Values sorted by sort_order
  const sortedValues = selectedScale
    ? [...selectedScale.values].sort((a, b) => a.sort_order - b.sort_order)
    : [];

  // ── Permissions ────────────────────────────────────────

  const canCreate = hasModuleAction('GRADING_CONFIG', 'CREATE') && (!isRoot || !!institutionId);
  const canPrint = hasModuleAction('GRADING_CONFIG', 'PRINT') && (!isRoot || !!institutionId);

  // ── Print view ─────────────────────────────────────────

  if (showPrint) {
    return (
      <ScalePrintView
        branding={buildBranding(config)}
        scales={filteredData}
        levelLabels={LEVEL_LABELS}
        modalityLabels={MODALITY_LABELS}
        statusLabels={INTERNAL_STATUS_LABELS}
        onClose={() => setShowPrint(false)}
      />
    );
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <div>
      <PremiumHeader
        title="Escalas de Calificación"
        subtitle="Gestioná las escalas de notas por nivel y modalidad educativa"
        icon="📊"
        stats={[{ label: 'escalas', value: String(data.length) }]}
      >
        {canCreate && (
          <Button
            variant={showScaleForm ? 'danger-soft' : 'success-soft'}
            onClick={() => {
              if (showScaleForm) clearScaleForm();
              else {
                setShowScaleForm(true);
                setScaleForm(EMPTY_SCALE_FORM);
                setEditingScaleId(null);
                setScaleSaveError('');
                setScaleFieldErrors({});
              }
            }}
          >
            {showScaleForm ? 'Cancelar' : 'Nueva escala'}
          </Button>
        )}
        {canPrint && data.length > 0 && (
          <Button variant="ghost" onClick={() => setShowPrint(true)}>
            🖨 Imprimir
          </Button>
        )}
      </PremiumHeader>

      {/* Institution selector — ROOT only */}
      {isRoot && (
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', marginBottom: 'var(--space-md)' }}>
          <div>
            <label
              htmlFor="institution-select"
              style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}
            >
              Institución
            </label>
            <select
              id="institution-select"
              value={institutionId}
              onChange={e => setInstitutionId(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 'var(--text-sm)',
                minWidth: '220px',
              }}
            >
              <option value="">Seleccioná una institución</option>
              {institutions.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Guard: ROOT must select institution before seeing data */}
      {isRoot && !institutionId ? (
        <Card className="mt-md">
          <p style={{ color: 'var(--color-text-muted)', padding: 'var(--space-md)', textAlign: 'center' }}>
            Seleccioná una institución para ver las escalas de calificación.
          </p>
        </Card>
      ) : (
        <>
          {/* Scale creation / edit form */}
          {showScaleForm && (
            <Card title={editingScaleId ? 'Editar escala' : 'Nueva escala de calificación'} className="mt-md">
              {scaleSaveError && (
                <div style={{
                  background: 'var(--color-danger-light)',
                  color: 'var(--color-danger)',
                  padding: 'var(--space-sm)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-md)',
                  fontSize: 'var(--text-sm)',
                }}>
                  {scaleSaveError}
                </div>
              )}

              <div className="flex flex-col gap-md">
                <Input
                  label="Nombre *"
                  id="scale-name-input"
                  value={scaleForm.name}
                  onChange={e => updateScaleField('name', e.target.value)}
                  placeholder="Nombre de la escala"
                  error={scaleFieldErrors.name}
                />

                {!editingScaleId && (
                  <>
                    <div className="field">
                      <label className="field-label" htmlFor="scale-level-select">Nivel educativo *</label>
                      <select
                        id="scale-level-select"
                        name="level"
                        className="input"
                        value={scaleForm.level}
                        onChange={e => updateScaleField('level', Number(e.target.value))}
                        style={{ width: '100%' }}
                        aria-label="Nivel educativo"
                      >
                        {LEVEL_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="scale-modality-select">Modalidad</label>
                      <select
                        id="scale-modality-select"
                        name="modality"
                        className="input"
                        value={scaleForm.modality}
                        onChange={e => updateScaleField('modality', Number(e.target.value))}
                        style={{ width: '100%' }}
                        aria-label="Modalidad"
                      >
                        {MODALITY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div style={{ marginTop: 'var(--space-lg)', display: 'flex', gap: 'var(--space-md)' }}>
                {editingScaleId ? (
                  <Button variant="success-soft" onClick={handleSaveScale} loading={scaleSaving}>
                    Guardar cambios
                  </Button>
                ) : (
                  <Button variant="success-soft" onClick={handleCreateScale} loading={scaleSaving}>
                    Crear escala
                  </Button>
                )}
                <Button variant="danger-soft" onClick={clearScaleForm}>Cancelar</Button>
              </div>
            </Card>
          )}

          {/* Filters + main table */}
          <Card className="mt-md">
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
              <div className="field" style={{ minWidth: 160 }}>
                <label className="field-label">Filtrar por nivel</label>
                <select
                  className="input"
                  value={filterLevel}
                  onChange={e => setFilterLevel(e.target.value)}
                  style={{ width: '100%' }}
                  aria-label="Filtrar por nivel"
                >
                  <option value="">Todos</option>
                  {LEVEL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ minWidth: 160 }}>
                <label className="field-label">Filtrar por modalidad</label>
                <select
                  className="input"
                  value={filterModality}
                  onChange={e => setFilterModality(e.target.value)}
                  style={{ width: '100%' }}
                  aria-label="Filtrar por modalidad"
                >
                  <option value="">Todas</option>
                  {MODALITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <Table
              columns={[
                { key: 'name', header: 'Nombre' },
                {
                  key: 'level',
                  header: 'Nivel',
                  render: (row: Record<string, unknown>) =>
                    LEVEL_LABELS[row.level as number] ?? String(row.level),
                },
                {
                  key: 'modality',
                  header: 'Modalidad',
                  render: (row: Record<string, unknown>) =>
                    MODALITY_LABELS[row.modality as number] ?? String(row.modality),
                },
                {
                  key: 'active',
                  header: 'Estado',
                  render: (row: Record<string, unknown>) => (
                    <span style={{ color: row.active ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                      {row.active ? 'Activo' : 'Inactivo'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  render: (row: Record<string, unknown>) => {
                    const r = row as unknown as GradeScaleRow;
                    const canEdit = hasModuleAction('GRADING_CONFIG', 'UPDATE');
                    const canDelete = hasModuleAction('GRADING_CONFIG', 'DELETE');
                    return (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <Button
                          variant="action"
                          size="sm"
                          onClick={() => {
                            setSelectedScaleId(selectedScaleId === r.id ? null : r.id);
                            setShowValueForm(false);
                            setValueForm(EMPTY_VALUE_FORM);
                          }}
                        >
                          Valores
                        </Button>
                        {canEdit && (
                          <Button variant="action" size="sm" onClick={() => handleEditScale(r)}>
                            Editar
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="danger-soft" size="sm" onClick={() => setDeleteTarget(r)}>
                            Eliminar
                          </Button>
                        )}
                      </div>
                    );
                  },
                },
              ]}
              data={filteredData as unknown as Record<string, unknown>[]}
              emptyMessage={loading ? 'Cargando...' : 'No hay escalas de calificación'}
            />
          </Card>

          {/* Values section for the selected scale */}
          {selectedScale && (
            <Card
              title={`Valores — ${selectedScale.name} (${LEVEL_LABELS[selectedScale.level] ?? selectedScale.level})`}
              className="mt-md"
            >
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <Button
                  variant={showValueForm ? 'danger-soft' : 'success-soft'}
                  size="sm"
                  onClick={() => {
                    if (showValueForm) clearValueForm();
                    else { setEditingValueId(null); setValueForm(EMPTY_VALUE_FORM); setShowValueForm(true); }
                  }}
                >
                  {showValueForm ? 'Cancelar' : 'Nuevo valor'}
                </Button>
              </div>

              {/* Value creation form */}
              {showValueForm && (
                <div style={{
                  background: 'var(--color-surface-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  marginBottom: 'var(--space-md)',
                }}>
                  {valueSaveError && (
                    <div style={{
                      background: 'var(--color-danger-light)',
                      color: 'var(--color-danger)',
                      padding: 'var(--space-sm)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 'var(--space-md)',
                      fontSize: 'var(--text-sm)',
                    }}>
                      {valueSaveError}
                    </div>
                  )}
                  <div className="flex flex-col gap-md">
                    <Input
                      label={editingValueId ? 'Código (no editable)' : 'Código *'}
                      id="value-code-input"
                      value={valueForm.code}
                      onChange={e => updateValueField('code', e.target.value)}
                      placeholder="10, A+, Logrado..."
                      error={valueFieldErrors.code}
                      disabled={!!editingValueId}
                    />
                    <Input
                      label="Etiqueta *"
                      id="value-label-input"
                      value={valueForm.label}
                      onChange={e => updateValueField('label', e.target.value)}
                      placeholder="Diez, Muy Bueno..."
                      error={valueFieldErrors.label}
                    />
                    <div className="field">
                      <label className="field-label" htmlFor="internal-status-select">Estado interno *</label>
                      <select
                        id="internal-status-select"
                        name="internalStatus"
                        className="input"
                        value={valueForm.internalStatus}
                        onChange={e => updateValueField('internalStatus', e.target.value)}
                        style={{ width: '100%' }}
                        aria-label="Estado interno"
                      >
                        {INTERNAL_STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {valueFieldErrors.internalStatus && (
                        <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', marginTop: '0.25rem' }}>
                          {valueFieldErrors.internalStatus}
                        </p>
                      )}
                    </div>
                    <Input
                      label="Orden (0 = primero)"
                      id="value-sort-order-input"
                      type="number"
                      min="0"
                      value={valueForm.sortOrder}
                      onChange={e => updateValueField('sortOrder', e.target.value)}
                      error={valueFieldErrors.sortOrder}
                    />
                  </div>
                  <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
                    <Button variant="success-soft" onClick={handleSaveValue} loading={valueSaving}>
                      {editingValueId ? 'Guardar cambios' : 'Agregar valor'}
                    </Button>
                    <Button variant="danger-soft" onClick={clearValueForm}>Cancelar</Button>
                  </div>
                </div>
              )}

              {/* Values table */}
              <Table
                columns={[
                  { key: 'code', header: 'Código' },
                  { key: 'label', header: 'Etiqueta' },
                  {
                    key: 'internal_status',
                    header: 'Estado',
                    render: (row: Record<string, unknown>) => {
                      const status = row.internal_status as string;
                      const labelText = INTERNAL_STATUS_LABELS[status] ?? status;
                      const colorMap: Record<string, string> = {
                        APROBADO: 'var(--color-success)',
                        NO_APROBADO: 'var(--color-danger)',
                        EN_PROCESO: 'var(--color-warning, #f59e0b)',
                        LIBRE: 'var(--color-text-muted)',
                      };
                      return (
                        <span style={{ color: colorMap[status] ?? 'var(--color-text)', fontWeight: 500, fontSize: 'var(--text-sm)' }}>
                          {labelText}
                        </span>
                      );
                    },
                  },
                  {
                    key: 'sort_order',
                    header: 'Orden',
                    render: (row: Record<string, unknown>) => String(row.sort_order),
                  },
                  {
                    key: 'value_actions',
                    header: '',
                    render: (row: Record<string, unknown>) => {
                      const v = row as unknown as GradeScaleValueRow;
                      const canEditValue = hasModuleAction('GRADING_CONFIG', 'UPDATE');
                      const canDeleteValue = hasModuleAction('GRADING_CONFIG', 'DELETE');
                      return (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          {canEditValue && (
                            <Button variant="action" size="sm" onClick={() => handleEditValue(v)}>
                              Editar
                            </Button>
                          )}
                          {canDeleteValue && (
                            <Button variant="danger-soft" size="sm" onClick={() => setDeleteValueTarget(v)}>
                              Eliminar
                            </Button>
                          )}
                        </div>
                      );
                    },
                  },
                ]}
                data={sortedValues as unknown as Record<string, unknown>[]}
                emptyMessage="Esta escala no tiene valores aún. Agregá el primero."
              />
            </Card>
          )}

          {/* Delete scale confirmation modal */}
          {deleteTarget && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}>
              <div style={{
                background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-lg)', maxWidth: 400, width: '100%',
                boxShadow: 'var(--shadow-lg)',
              }}>
                <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>
                  Confirmar eliminación
                </h3>
                <p style={{ marginBottom: 'var(--space-md)' }}>
                  ¿Estás seguro de que querés eliminar la escala <strong>{deleteTarget.name}</strong>?
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end' }}>
                  <Button variant="danger-soft" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                  <Button onClick={handleDeleteScaleConfirm} loading={deletingScale}>Eliminar</Button>
                </div>
              </div>
            </div>
          )}

          {/* Delete value confirmation modal */}
          {deleteValueTarget && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}>
              <div style={{
                background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-lg)', maxWidth: 400, width: '100%',
                boxShadow: 'var(--shadow-lg)',
              }}>
                <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>
                  Confirmar eliminación
                </h3>
                <p style={{ marginBottom: 'var(--space-md)' }}>
                  ¿Estás seguro de que querés eliminar el valor <strong>{deleteValueTarget.code}</strong> — {deleteValueTarget.label}?
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end' }}>
                  <Button variant="danger-soft" onClick={() => setDeleteValueTarget(null)}>Cancelar</Button>
                  <Button onClick={handleDeleteValueConfirm} loading={deletingValue}>Eliminar</Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
