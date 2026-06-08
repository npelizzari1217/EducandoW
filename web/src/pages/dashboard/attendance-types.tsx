import { useState, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import { useApiList, useApiDelete, extractErrorMessage } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import apiClient from '../../api/client';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

// ── Constants ──

const LEVEL_OPTIONS = [
  { value: 1, label: 'Inicial' },
  { value: 2, label: 'Primario' },
  { value: 3, label: 'Secundario' },
  { value: 4, label: 'Terciario' },
];

// ── Types ──

interface AttendanceTypeRow {
  id: string;
  code: string;
  description: string;
  absence_value: number;
  level: number;
  assignable: boolean;
  is_system: boolean;
  active: boolean;
}

interface AttendanceTypeForm {
  code: string;
  description: string;
  absenceValue: string;
  level: number;
  assignable: boolean;
  active: boolean;
}

type FieldErrors = Partial<Record<keyof AttendanceTypeForm, string>>;

const EMPTY_FORM: AttendanceTypeForm = {
  code: '',
  description: '',
  absenceValue: '0',
  level: 2,
  assignable: true,
  active: true,
};

const LEVEL_LABELS: Record<number, string> = {
  1: 'Inicial',
  2: 'Primario',
  3: 'Secundario',
  4: 'Terciario',
};

// ── Page component ──

export default function AttendanceTypesPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useApiList<AttendanceTypeRow>('/attendance-types');
  const { deleting, del } = useApiDelete('/attendance-types');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AttendanceTypeForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<AttendanceTypeRow | null>(null);

  // Filter state
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');

  const isRoot = user?.roles?.includes('ROOT') ?? false;
  const userModules = user?.modules ?? [];
  const hasModuleAction = (moduleCode: string, ...actions: string[]) =>
    isRoot || userModules.some((m: { moduleCode: string; actions: string[] }) => m.moduleCode === moduleCode && actions.some((a) => m.actions.includes(a)));

  const update = (field: keyof AttendanceTypeForm, value: string | boolean | number) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  };

  const validateForm = useCallback((): boolean => {
    const errs: FieldErrors = {};
    if (!form.code.trim()) errs.code = 'El código es obligatorio';
    else if (form.code.trim().length > 4) errs.code = 'El código tiene máx. 4 caracteres';
    if (!form.description.trim()) errs.description = 'La descripción es obligatoria';
    const absNum = Number(form.absenceValue);
    if (isNaN(absNum) || absNum < 0) errs.absenceValue = 'Debe ser un número >= 0';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  const buildPayload = useCallback(() => ({
    code: form.code.trim().toUpperCase(),
    description: form.description.trim(),
    absenceValue: Number(form.absenceValue),
    level: form.level,
    assignable: form.assignable,
    active: form.active,
  }), [form]);

  const handleCreate = async () => {
    if (!validateForm()) return;
    setSaving(true); setSaveError('');
    try {
      await apiClient.post('/attendance-types', buildPayload());
      setShowForm(false);
      setForm(EMPTY_FORM);
      setFieldErrors({});
      reload();
    } catch (e: unknown) {
      setSaveError(extractErrorMessage(e) || 'Error al crear tipo de asistencia');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (row: AttendanceTypeRow) => {
    setEditingId(row.id);
    setSaveError('');
    setFieldErrors({});
    setForm({
      code: row.code,
      description: row.description,
      absenceValue: String(row.absence_value),
      level: row.level,
      assignable: row.assignable,
      active: row.active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editingId) return;
    if (!validateForm()) return;
    setSaving(true); setSaveError('');
    try {
      await apiClient.patch(`/attendance-types/${editingId}`, {
        description: form.description.trim(),
        absenceValue: Number(form.absenceValue),
        assignable: form.assignable,
        active: form.active,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      setFieldErrors({});
      reload();
    } catch (e: unknown) {
      setSaveError(extractErrorMessage(e) || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const success = await del(deleteTarget.id);
    setDeleteTarget(null);
    if (success) {
      reload();
    } else {
      alert('Error al eliminar. Intentá de nuevo.');
    }
  };

  const clearForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSaveError('');
    setFieldErrors({});
  };

  // Filtered data (client-side filter for level and active)
  const filteredData = data.filter((row) => {
    if (filterLevel && row.level !== Number(filterLevel)) return false;
    if (filterActive === 'true' && !row.active) return false;
    if (filterActive === 'false' && row.active) return false;
    return true;
  });

  return (
    <div>
      <PremiumHeader
        title="Tipos de Asistencia"
        subtitle="Gestioná los tipos de asistencia por nivel educativo"
        icon="📋"
        stats={[{ label: 'tipos', value: String(data.length) }]}
      >
        {hasModuleAction('ATTENDANCE_TYPES', 'CREATE') && (
          <Button
            variant={showForm ? 'danger-soft' : 'success-soft'}
            onClick={() => {
              if (showForm) clearForm();
              else { setShowForm(true); setForm(EMPTY_FORM); setEditingId(null); setSaveError(''); setFieldErrors({}); }
            }}
          >
            {showForm ? 'Cancelar' : 'Nuevo tipo'}
          </Button>
        )}
      </PremiumHeader>

      {showForm && (
        <Card title={editingId ? 'Editar tipo de asistencia' : 'Nuevo tipo de asistencia'} className="mt-md">
          {saveError && (
            <div style={{
              background: 'var(--color-danger-light)',
              color: 'var(--color-danger)',
              padding: 'var(--space-sm)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-md)',
              fontSize: 'var(--text-sm)',
            }}>
              {saveError}
            </div>
          )}

          <div className="flex flex-col gap-md">
            {/* Code — only on create, invariant on edit */}
            {!editingId && (
              <Input
                label="Código * (máx. 4 caracteres)"
                value={form.code}
                onChange={(e) => update('code', e.target.value.toUpperCase())}
                placeholder="P, SAB, DOM, TAR..."
                maxLength={4}
                error={fieldErrors.code}
                id="level-code-input"
              />
            )}

            <Input
              label="Descripción *"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              error={fieldErrors.description}
            />

            <Input
              label="Valor de ausencia (0 = presente; 0.5, 1 = ausencia parcial/total)"
              value={form.absenceValue}
              type="number"
              min="0"
              step="0.5"
              onChange={(e) => update('absenceValue', e.target.value)}
              error={fieldErrors.absenceValue}
            />

            {/* Level selector — only on create (invariant on edit) */}
            {!editingId && (
              <div className="field">
                <label className="field-label" htmlFor="attendance-level-select">Nivel educativo *</label>
                <select
                  id="attendance-level-select"
                  name="level"
                  className="input"
                  value={form.level}
                  onChange={(e) => update('level', Number(e.target.value))}
                  style={{ width: '100%' }}
                  aria-label="Nivel educativo"
                >
                  {LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label className="field-label">Asignable manualmente</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0' }}>
                <input
                  type="checkbox"
                  checked={form.assignable}
                  onChange={(e) => update('assignable', e.target.checked)}
                />
                <span style={{ fontSize: 'var(--text-sm)' }}>
                  {form.assignable ? 'Sí — visible en la grilla diaria' : 'No — solo para autorrelleno'}
                </span>
              </label>
            </div>

            <div className="field">
              <label className="field-label">Estado</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0' }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => update('active', e.target.checked)}
                />
                <span style={{ fontSize: 'var(--text-sm)' }}>{form.active ? 'Activo' : 'Inactivo'}</span>
              </label>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-lg)', display: 'flex', gap: 'var(--space-md)' }}>
            {editingId ? (
              <Button variant="success-soft" onClick={handleSave} loading={saving}>Guardar cambios</Button>
            ) : (
              <Button variant="success-soft" onClick={handleCreate} loading={saving}>Crear tipo</Button>
            )}
          </div>
        </Card>
      )}

      {/* ── Filters ── */}
      <Card className="mt-md">
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 160 }}>
            <label className="field-label">Filtrar por nivel</label>
            <select
              className="input"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              style={{ width: '100%' }}
              aria-label="Filtrar por nivel"
            >
              <option value="">Todos</option>
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ minWidth: 160 }}>
            <label className="field-label">Filtrar por estado</label>
            <select
              className="input"
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              style={{ width: '100%' }}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
        </div>

        <Table
          columns={[
            { key: 'code', header: 'Código' },
            { key: 'description', header: 'Descripción' },
            {
              key: 'level',
              header: 'Nivel',
              render: (row: Record<string, unknown>) => LEVEL_LABELS[row.level as number] ?? String(row.level),
            },
            {
              key: 'absence_value',
              header: 'Valor ausencia',
              render: (row: Record<string, unknown>) => String(row.absence_value),
            },
            {
              key: 'assignable',
              header: 'Asignable',
              render: (row: Record<string, unknown>) => (row.assignable ? 'Sí' : 'No'),
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
              key: 'is_system',
              header: 'Sistema',
              render: (row: Record<string, unknown>) => (row.is_system ? '🔒 Sistema' : '—'),
            },
            {
              key: 'actions',
              header: '',
              render: (row: Record<string, unknown>) => {
                const r = row as unknown as AttendanceTypeRow;
                // System types cannot be edited or deleted
                if (r.is_system) {
                  return (
                    <span
                      title="Los tipos de sistema no se pueden editar ni eliminar"
                      style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}
                    >
                      Solo lectura
                    </span>
                  );
                }
                const canEdit = hasModuleAction('ATTENDANCE_TYPES', 'READ', 'UPDATE');
                const canDelete = hasModuleAction('ATTENDANCE_TYPES', 'DELETE');
                if (!canEdit && !canDelete) return null;
                return (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {canEdit && (
                      <Button variant="action" size="sm" onClick={() => handleEdit(r)}>Editar</Button>
                    )}
                    {canDelete && (
                      <Button variant="danger-soft" size="sm" onClick={() => setDeleteTarget(r)}>Eliminar</Button>
                    )}
                  </div>
                );
              },
            },
          ]}
          data={filteredData as unknown as Record<string, unknown>[]}
          emptyMessage={loading ? 'Cargando...' : 'No hay tipos de asistencia'}
        />
      </Card>

      {/* Delete confirmation modal */}
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
              ¿Estás seguro de que querés eliminar el tipo <strong>{deleteTarget.code}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end' }}>
              <Button variant="danger-soft" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button onClick={handleDeleteConfirm} loading={deleting}>Eliminar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
