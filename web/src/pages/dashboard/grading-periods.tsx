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

// ── Types ──────────────────────────────────────────────────

interface Institution { id: string; name: string; }

interface TemplateItemRow {
  id: string;
  name: string;
  sort_order: number;
}

interface TemplateRow {
  id: string;
  name: string;
  level: number;
  modality: number;
  active: boolean;
  items: TemplateItemRow[];
}

interface CycleRow {
  uuid: string;
  code: string;
  name: string;
  level: number;
  active: boolean;
  startDate: string;
  endDate: string;
}

interface TemplateForm {
  name: string;
  level: number;
  modality: number;
}

interface FormItem {
  localId: string;
  name: string;
  sortOrder: string;
}

type TemplateFieldErrors = Partial<Record<keyof TemplateForm, string>>;

const EMPTY_TEMPLATE_FORM: TemplateForm = { name: '', level: 2, modality: 0 };

function makeLocalId() {
  return Math.random().toString(36).slice(2);
}

// ── Page component ─────────────────────────────────────────

export default function GradingPeriodsPage() {
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
  const listUrl = (isRoot && !institutionId) ? '' : '/grading/period-templates';
  const cyclesUrl = (isRoot && !institutionId) ? '' : '/academic-cycles';

  const { data, loading, reload } = useApiList<TemplateRow>(listUrl, rootQueryParams);
  const { data: cycles } = useApiList<CycleRow>(cyclesUrl, rootQueryParams);
  const { deleting: deletingTemplate, del: delTemplate } = useApiDelete('/grading/period-templates', rootQueryParams);

  // Filters
  const [filterLevel, setFilterLevel] = useState('');
  const [filterModality, setFilterModality] = useState('');

  // Template form state (create / edit name only)
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState<TemplateForm>(EMPTY_TEMPLATE_FORM);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaveError, setTemplateSaveError] = useState('');
  const [templateFieldErrors, setTemplateFieldErrors] = useState<TemplateFieldErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null);

  // Dynamic items in create form
  const [formItems, setFormItems] = useState<FormItem[]>([]);

  // Items view (read-only) for an existing template
  const [viewItemsTemplateId, setViewItemsTemplateId] = useState<string | null>(null);
  const viewItemsTemplate = data.find(t => t.id === viewItemsTemplateId) ?? null;

  // Dates section state
  const [datesTemplateId, setDatesTemplateId] = useState<string | null>(null);
  const datesTemplate = data.find(t => t.id === datesTemplateId) ?? null;
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [periodDates, setPeriodDates] = useState<Record<string, { startDate: string; endDate: string }>>({});
  const [datesLoading, setDatesLoading] = useState(false);
  const [datesSaving, setDatesSaving] = useState(false);
  const [datesSaveError, setDatesSaveError] = useState('');

  // ── Template form helpers ────────────────────────────────

  const updateTemplateField = (field: keyof TemplateForm, value: string | number) => {
    setTemplateForm(f => ({ ...f, [field]: value }));
    if (templateFieldErrors[field]) {
      setTemplateFieldErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const validateTemplateForm = useCallback((): boolean => {
    const errs: TemplateFieldErrors = {};
    if (!templateForm.name.trim()) errs.name = 'El nombre es obligatorio';
    setTemplateFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [templateForm]);

  const clearTemplateForm = () => {
    setShowTemplateForm(false);
    setTemplateForm(EMPTY_TEMPLATE_FORM);
    setEditingTemplateId(null);
    setTemplateSaveError('');
    setTemplateFieldErrors({});
    setFormItems([]);
  };

  const handleCreateTemplate = async () => {
    if (!validateTemplateForm()) return;
    setTemplateSaving(true); setTemplateSaveError('');
    try {
      await apiClient.post('/grading/period-templates', {
        name: templateForm.name.trim(),
        level: templateForm.level,
        modality: templateForm.modality,
        items: formItems.map(item => ({
          name: item.name.trim(),
          sortOrder: Number(item.sortOrder),
        })).filter(item => item.name),
      }, { params: rootQueryParams });
      clearTemplateForm();
      reload();
    } catch (e: unknown) {
      setTemplateSaveError(extractErrorMessage(e) || 'Error al crear plantilla');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleEditTemplate = (row: TemplateRow) => {
    setEditingTemplateId(row.id);
    setTemplateForm({ name: row.name, level: row.level, modality: row.modality });
    setTemplateSaveError('');
    setTemplateFieldErrors({});
    setShowTemplateForm(true);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplateId) return;
    if (!validateTemplateForm()) return;
    setTemplateSaving(true); setTemplateSaveError('');
    try {
      await apiClient.patch(`/grading/period-templates/${editingTemplateId}`, {
        name: templateForm.name.trim(),
      }, { params: rootQueryParams });
      clearTemplateForm();
      reload();
    } catch (e: unknown) {
      setTemplateSaveError(extractErrorMessage(e) || 'Error al guardar');
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplateConfirm = async () => {
    if (!deleteTarget) return;
    const success = await delTemplate(deleteTarget.id);
    setDeleteTarget(null);
    if (success) {
      if (viewItemsTemplateId === deleteTarget.id) setViewItemsTemplateId(null);
      if (datesTemplateId === deleteTarget.id) setDatesTemplateId(null);
      reload();
    } else {
      alert('Error al eliminar. Puede que esta plantilla tenga fechas asociadas.');
    }
  };

  // ── Dynamic items helpers ────────────────────────────────

  const addFormItem = () => {
    const nextOrder = formItems.length + 1;
    setFormItems(items => [
      ...items,
      { localId: makeLocalId(), name: '', sortOrder: String(nextOrder) },
    ]);
  };

  const removeFormItem = (localId: string) => {
    setFormItems(items => items.filter(i => i.localId !== localId));
  };

  const updateFormItem = (localId: string, field: 'name' | 'sortOrder', value: string) => {
    setFormItems(items => items.map(i => i.localId === localId ? { ...i, [field]: value } : i));
  };

  // ── Dates section helpers ────────────────────────────────

  const openDatesSection = (template: TemplateRow) => {
    setDatesTemplateId(template.id);
    setSelectedCycleId('');
    setPeriodDates({});
    setDatesSaveError('');
    // Close other sections
    setViewItemsTemplateId(null);
  };

  const handleCycleSelect = async (cycleId: string) => {
    setSelectedCycleId(cycleId);
    setPeriodDates({});
    if (!datesTemplateId || !cycleId) return;

    setDatesLoading(true);
    try {
      const res = await apiClient.get(
        `/grading/period-templates/${datesTemplateId}/dates`,
        { params: { ...rootQueryParams, cycleId } },
      );
      const existingDates: Array<{ item_id: string; start_date: string; end_date: string }> =
        res.data?.data ?? [];

      const map: Record<string, { startDate: string; endDate: string }> = {};
      existingDates.forEach(d => {
        map[d.item_id] = {
          startDate: d.start_date ? d.start_date.split('T')[0] : '',
          endDate: d.end_date ? d.end_date.split('T')[0] : '',
        };
      });
      setPeriodDates(map);
    } catch {
      // ignore; form starts empty
    } finally {
      setDatesLoading(false);
    }
  };

  const updatePeriodDate = (itemId: string, field: 'startDate' | 'endDate', value: string) => {
    setPeriodDates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId] ?? { startDate: '', endDate: '' }, [field]: value },
    }));
  };

  const handleSaveDates = async () => {
    if (!datesTemplate || !selectedCycleId) return;
    setDatesSaving(true); setDatesSaveError('');
    try {
      const dates = datesTemplate.items.map(item => ({
        itemId: item.id,
        startDate: periodDates[item.id]?.startDate ?? '',
        endDate: periodDates[item.id]?.endDate ?? '',
      })).filter(d => d.startDate && d.endDate);

      await apiClient.put(
        `/grading/period-templates/${datesTemplate.id}/dates`,
        { cycleId: selectedCycleId, dates },
        { params: rootQueryParams },
      );
      setDatesSaveError('');
    } catch (e: unknown) {
      setDatesSaveError(extractErrorMessage(e) || 'Error al guardar fechas');
    } finally {
      setDatesSaving(false);
    }
  };

  // ── Filtered data ────────────────────────────────────────

  const filteredData = data.filter(row => {
    if (filterLevel && row.level !== Number(filterLevel)) return false;
    if (filterModality !== '' && row.modality !== Number(filterModality)) return false;
    return true;
  });

  // ── Permissions ──────────────────────────────────────────

  const canCreate = hasModuleAction('GRADING_CONFIG', 'CREATE') && (!isRoot || !!institutionId);

  // ── Render ───────────────────────────────────────────────

  return (
    <div>
      <PremiumHeader
        title="Períodos de Calificación"
        subtitle="Gestioná las plantillas de períodos por nivel y modalidad educativa"
        icon="📅"
        stats={[{ label: 'plantillas', value: String(data.length) }]}
      >
        {canCreate && (
          <Button
            variant={showTemplateForm ? 'danger-soft' : 'success-soft'}
            onClick={() => {
              if (showTemplateForm) clearTemplateForm();
              else {
                setShowTemplateForm(true);
                setTemplateForm(EMPTY_TEMPLATE_FORM);
                setEditingTemplateId(null);
                setFormItems([]);
                setTemplateSaveError('');
                setTemplateFieldErrors({});
              }
            }}
          >
            {showTemplateForm ? 'Cancelar' : 'Nueva plantilla'}
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
            Seleccioná una institución para ver los períodos de calificación.
          </p>
        </Card>
      ) : (
        <>
          {/* Template creation / edit form */}
          {showTemplateForm && (
            <Card title={editingTemplateId ? 'Editar plantilla' : 'Nueva plantilla de períodos'} className="mt-md">
              {templateSaveError && (
                <div style={{
                  background: 'var(--color-danger-light)',
                  color: 'var(--color-danger)',
                  padding: 'var(--space-sm)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-md)',
                  fontSize: 'var(--text-sm)',
                }}>
                  {templateSaveError}
                </div>
              )}

              <div className="flex flex-col gap-md">
                <Input
                  label="Nombre *"
                  id="template-name-input"
                  value={templateForm.name}
                  onChange={e => updateTemplateField('name', e.target.value)}
                  placeholder="Nombre de la plantilla"
                  error={templateFieldErrors.name}
                />

                {!editingTemplateId && (
                  <>
                    <div className="field">
                      <label className="field-label" htmlFor="template-level-select">Nivel educativo *</label>
                      <select
                        id="template-level-select"
                        name="level"
                        className="input"
                        value={templateForm.level}
                        onChange={e => updateTemplateField('level', Number(e.target.value))}
                        style={{ width: '100%' }}
                        aria-label="Nivel educativo"
                      >
                        {LEVEL_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="template-modality-select">Modalidad</label>
                      <select
                        id="template-modality-select"
                        name="modality"
                        className="input"
                        value={templateForm.modality}
                        onChange={e => updateTemplateField('modality', Number(e.target.value))}
                        style={{ width: '100%' }}
                        aria-label="Modalidad"
                      >
                        {MODALITY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Dynamic items */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                        <label className="field-label">Ítems de la plantilla</label>
                        <Button variant="action" size="sm" onClick={addFormItem}>
                          Agregar ítem
                        </Button>
                      </div>

                      {formItems.length === 0 && (
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                          Agregá al menos un ítem. Podés dejarlo vacío y agregar ítems después.
                        </p>
                      )}

                      {formItems.map((item) => (
                        <div
                          key={item.localId}
                          data-testid="template-item-row"
                          style={{
                            display: 'flex',
                            gap: 'var(--space-sm)',
                            alignItems: 'center',
                            marginBottom: 'var(--space-sm)',
                            padding: 'var(--space-sm)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          <input
                            className="input"
                            style={{ flex: 1 }}
                            placeholder="Nombre del período"
                            value={item.name}
                            onChange={e => updateFormItem(item.localId, 'name', e.target.value)}
                            data-item-name="true"
                          />
                          <input
                            type="number"
                            className="input"
                            style={{ width: '80px' }}
                            placeholder="Orden"
                            min="1"
                            value={item.sortOrder}
                            onChange={e => updateFormItem(item.localId, 'sortOrder', e.target.value)}
                            aria-label="Orden del ítem"
                            data-item-sort="true"
                          />
                          <Button variant="danger-soft" size="sm" onClick={() => removeFormItem(item.localId)}>
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div style={{ marginTop: 'var(--space-lg)', display: 'flex', gap: 'var(--space-md)' }}>
                {editingTemplateId ? (
                  <Button variant="success-soft" onClick={handleSaveTemplate} loading={templateSaving}>
                    Guardar cambios
                  </Button>
                ) : (
                  <Button variant="success-soft" onClick={handleCreateTemplate} loading={templateSaving}>
                    Crear plantilla
                  </Button>
                )}
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
                  key: 'itemCount',
                  header: 'Ítems',
                  render: (row: Record<string, unknown>) => {
                    const r = row as unknown as TemplateRow;
                    return String(r.items?.length ?? 0);
                  },
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
                    const r = row as unknown as TemplateRow;
                    const canEdit = hasModuleAction('GRADING_CONFIG', 'READ', 'UPDATE');
                    const canDelete = hasModuleAction('GRADING_CONFIG', 'DELETE');
                    return (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <Button
                          variant="action"
                          size="sm"
                          onClick={() => {
                            setViewItemsTemplateId(viewItemsTemplateId === r.id ? null : r.id);
                            if (datesTemplateId === r.id) setDatesTemplateId(null);
                          }}
                        >
                          Ítems
                        </Button>
                        <Button
                          variant="action"
                          size="sm"
                          onClick={() => {
                            if (datesTemplateId === r.id) {
                              setDatesTemplateId(null);
                            } else {
                              openDatesSection(r);
                            }
                          }}
                        >
                          Fechas
                        </Button>
                        {canEdit && (
                          <Button variant="action" size="sm" onClick={() => handleEditTemplate(r)}>
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
              emptyMessage={loading ? 'Cargando...' : 'No hay plantillas de períodos'}
            />
          </Card>

          {/* Items view section for the selected template */}
          {viewItemsTemplate && (
            <Card
              title={`Ítems — ${viewItemsTemplate.name} (${LEVEL_LABELS[viewItemsTemplate.level] ?? viewItemsTemplate.level})`}
              className="mt-md"
            >
              <Table
                columns={[
                  { key: 'sort_order', header: 'Orden' },
                  { key: 'name', header: 'Nombre del período' },
                ]}
                data={[...viewItemsTemplate.items]
                  .sort((a, b) => a.sort_order - b.sort_order) as unknown as Record<string, unknown>[]}
                emptyMessage="Esta plantilla no tiene ítems."
              />
            </Card>
          )}

          {/* Dates section for the selected template */}
          {datesTemplate && (
            <Card
              title={`Fechas de Períodos — ${datesTemplate.name}`}
              className="mt-md"
            >
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <label
                  htmlFor="cycle-select"
                  className="field-label"
                  style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}
                >
                  Ciclo lectivo
                </label>
                <select
                  id="cycle-select"
                  className="input"
                  value={selectedCycleId}
                  onChange={e => handleCycleSelect(e.target.value)}
                  style={{ minWidth: '220px' }}
                  aria-label="Ciclo lectivo"
                >
                  <option value="">Seleccioná un ciclo lectivo</option>
                  {cycles.map(c => (
                    <option key={c.uuid} value={c.uuid}>
                      {c.name} ({LEVEL_LABELS[c.level] ?? c.level})
                    </option>
                  ))}
                </select>
              </div>

              {selectedCycleId && (
                <>
                  {datesLoading ? (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Cargando fechas...</p>
                  ) : (
                    <>
                      {datesSaveError && (
                        <div style={{
                          background: 'var(--color-danger-light)',
                          color: 'var(--color-danger)',
                          padding: 'var(--space-sm)',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: 'var(--space-md)',
                          fontSize: 'var(--text-sm)',
                        }}>
                          {datesSaveError}
                        </div>
                      )}

                      <div style={{ marginBottom: 'var(--space-md)' }}>
                        {[...datesTemplate.items]
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map(item => (
                            <div
                              key={item.id}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 200px 200px',
                                gap: 'var(--space-md)',
                                alignItems: 'center',
                                padding: 'var(--space-sm)',
                                borderBottom: '1px solid var(--color-border)',
                              }}
                            >
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                                {item.name}
                              </span>
                              <div>
                                <label
                                  className="field-label"
                                  style={{ fontSize: 'var(--text-xs, 0.75rem)', marginBottom: '0.2rem', display: 'block' }}
                                >
                                  Fecha inicio
                                </label>
                                <input
                                  type="date"
                                  className="input"
                                  value={periodDates[item.id]?.startDate ?? ''}
                                  onChange={e => updatePeriodDate(item.id, 'startDate', e.target.value)}
                                  aria-label={`Fecha inicio ${item.name}`}
                                  style={{ width: '100%' }}
                                />
                              </div>
                              <div>
                                <label
                                  className="field-label"
                                  style={{ fontSize: 'var(--text-xs, 0.75rem)', marginBottom: '0.2rem', display: 'block' }}
                                >
                                  Fecha fin
                                </label>
                                <input
                                  type="date"
                                  className="input"
                                  value={periodDates[item.id]?.endDate ?? ''}
                                  onChange={e => updatePeriodDate(item.id, 'endDate', e.target.value)}
                                  aria-label={`Fecha fin ${item.name}`}
                                  style={{ width: '100%' }}
                                />
                              </div>
                            </div>
                          ))}
                      </div>

                      <Button variant="success-soft" onClick={handleSaveDates} loading={datesSaving}>
                        Guardar fechas
                      </Button>
                    </>
                  )}
                </>
              )}
            </Card>
          )}

          {/* Delete template confirmation modal */}
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
                  ¿Estás seguro de que querés eliminar la plantilla <strong>{deleteTarget.name}</strong>?
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end' }}>
                  <Button variant="danger-soft" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                  <Button onClick={handleDeleteTemplateConfirm} loading={deletingTemplate}>Eliminar</Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
