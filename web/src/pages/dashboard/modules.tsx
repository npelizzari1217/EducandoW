import { useState } from 'react';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiDelete, useApiCreate, useApiUpdate } from '../../hooks/use-api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import PremiumHeader from '../../components/ui/premium-header';
import ModulePrintView from '../../components/reports/ModulePrintView';
import { buildBranding } from '../../components/reports/PremiumPrintReport';

// ── Tipos ─────────────────────────────────────────────────

interface Module {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Iconos por módulo ──

const MODULE_ICONS: Record<string, string> = {
  INSTITUTIONS: '🏛', USERS: '👥', STUDENTS: '🎓', TEACHERS: '👨‍🏫',
  SUBJECTS: '📚', COURSES: '📋', ENROLLMENTS: '📝', GRADES: '⭐',
  ATTENDANCE: '📅', REPORTS: '📊',
};

function moduleIcon(code: string): string {
  return MODULE_ICONS[code] ?? '📦';
}

// ── Descripciones ─────────────────────────────────────────

const MODULE_DESCRIPTIONS: Record<string, string> = {
  INSTITUTIONS: 'Administración de instituciones educativas y sus configuraciones',
  USERS: 'Control de acceso, autenticación y gestión de usuarios del sistema',
  STUDENTS: 'Registro, seguimiento y ficha académica de alumnos',
  TEACHERS: 'Gestión de docentes, asignaciones y carga horaria',
  SUBJECTS: 'Catálogo de materias y espacios curriculares',
  COURSES: 'Configuración de cursos, divisiones y secciones',
  ENROLLMENTS: 'Proceso de matriculación y asignación de estudiantes',
  GRADES: 'Registro de calificaciones, evaluaciones y boletines',
  ATTENDANCE: 'Control de asistencia diaria y seguimiento de inasistencias',
  REPORTS: 'Generación de informes, estadísticas y documentos PDF',
};

function moduleDescription(code: string): string {
  return MODULE_DESCRIPTIONS[code] ?? 'Módulo del sistema educativo';
}

// ── Componente ────────────────────────────────────────────

export default function ModulesPage() {
  const { config } = useInstitution();
  const { data, loading, reload } = useApiList<Module>('/modules');
  const { deleting, del } = useApiDelete('/modules');
  const { creating, createError, create, setCreateError } = useApiCreate('/modules');
  const { updating, updateError, update, setUpdateError } = useApiUpdate('/modules');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', active: true });
  const [showPrint, setShowPrint] = useState(false);

  const resetForm = () => {
    setForm({ code: '', name: '', active: true });
    setEditingId(null);
    setShowForm(false);
    setCreateError('');
    setUpdateError('');
  };

  const handleCreate = async () => {
    const ok = await create({ code: form.code, name: form.name });
    if (ok) { resetForm(); reload(); }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const ok = await update(editingId, { code: form.code, name: form.name, active: form.active });
    if (ok) { resetForm(); reload(); }
  };

  const startEdit = (m: Module) => {
    setEditingId(m.id);
    setForm({ code: m.code, name: m.name, active: m.active });
    setShowForm(true);
  };

  if (showPrint) {
    return (
      <ModulePrintView
        branding={buildBranding(config)}
        modules={data.map(m => ({
          code: m.code,
          name: m.name,
          description: moduleDescription(m.code),
          active: m.active,
        }))}
        onClose={() => setShowPrint(false)}
      />
    );
  }

  return (
    <div className="modules-page">
      <style>{`
        .modules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
        }
        @media (max-width: 700px) {
          .modules-grid { grid-template-columns: 1fr; }
        }
        .m-card {
          background: var(--color-surface, #fff);
          border-radius: 16px; padding: 1.4rem;
          border: 1px solid var(--color-border, #e8ecf1);
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: default; position: relative; overflow: hidden;
          display: flex; flex-direction: column; gap: 0.75rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02);
        }
        .m-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 28px rgba(15, 43, 74, 0.1), 0 4px 10px rgba(15, 43, 74, 0.06);
          border-color: rgba(37, 99, 235, 0.2);
        }
        .m-card::after {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #2563eb, #6366f1, #818cf8);
          opacity: 0; transition: opacity 0.22s ease;
        }
        .m-card:hover::after { opacity: 1; }
        .m-card.inactive { opacity: 0.55; }
        .m-card.inactive:hover { opacity: 0.8; }
        .m-card-top { display: flex; align-items: flex-start; gap: 0.85rem; }
        .m-card-icon {
          width: 48px; height: 48px; border-radius: 12px;
          background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.3rem; flex-shrink: 0;
          border: 1px solid rgba(99,102,241,0.1);
        }
        .m-card-info { flex: 1; min-width: 0; }
        .m-card-code {
          display: inline-block; font-size: 0.68rem; font-weight: 700;
          letter-spacing: 0.06em; color: #6366f1; background: #eef2ff;
          padding: 0.15rem 0.55rem; border-radius: 6px; margin-bottom: 0.4rem;
        }
        .m-card-name {
          font-size: 0.95rem; font-weight: 650;
          color: var(--color-text, #1e293b); line-height: 1.3;
        }
        .m-card-desc {
          font-size: 0.76rem; color: var(--color-text-muted, #64748b);
          line-height: 1.45; margin-top: 0.25rem;
        }
        .m-card-footer {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: auto; padding-top: 0.5rem;
          border-top: 1px solid var(--color-border, #f1f5f9);
        }
        .m-card-status { display: flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; font-weight: 500; }
        .m-card-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .m-card-status-dot.active { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.4); }
        .m-card-status-dot.inactive { background: #94a3b8; }
        .m-card-actions { display: flex; gap: 0.3rem; }
        .m-card-btn {
          padding: 0.35rem 0.7rem; border-radius: 8px;
          font-size: 0.72rem; font-weight: 600; border: none; cursor: pointer;
          transition: all 0.15s ease; white-space: nowrap;
        }
        .m-card-btn-edit { background: #eef2ff; color: #4f46e5; }
        .m-card-btn-edit:hover { background: #e0e7ff; }
        .m-card-btn-del { background: #fef2f2; color: #dc2626; }
        .m-card-btn-del:hover { background: #fee2e2; }
        .mph-form-card {
          background: var(--color-surface, #fff); border-radius: 16px;
          padding: 1.5rem; margin-bottom: 1.5rem;
          border: 1px solid var(--color-border, #e8ecf1);
          box-shadow: 0 4px 16px rgba(15, 43, 74, 0.06);
        }
        .mph-form-title { font-size: 1rem; font-weight: 700; color: var(--color-text, #1e293b); margin-bottom: 1rem; }
        .mph-form-error {
          background: #fef2f2; color: #dc2626; padding: 0.6rem 0.85rem;
          border-radius: 10px; margin-bottom: 1rem; font-size: 0.82rem; font-weight: 500;
        }
        .modules-empty {
          text-align: center; padding: 3.5rem 2rem; grid-column: 1 / -1;
        }
        .modules-empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.4; }
        .modules-empty-text { font-size: 1rem; color: var(--color-text-muted, #64748b); font-weight: 500; }
        @media print {
          body * { visibility: hidden; }
          .modules-page, .modules-page * { visibility: visible; }
          .modules-page { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .m-card { box-shadow: none; border: 1px solid #e2e8f0; break-inside: avoid; }
          .m-card:hover { transform: none; box-shadow: none; }
          .m-card::after { display: none; }
        }
      `}</style>

      <PremiumHeader
        title="Módulos del Sistema"
        subtitle="Panel de Administración"
        icon="🏫"
        stats={[
          { label: 'módulos activos', value: String(data.length) },
          { label: 'Última actualización', value: data.length > 0 ? new Date(Math.max(...data.map(m => new Date(m.updatedAt).getTime()))).toLocaleDateString('es-AR') : '—' },
        ]}
      >
        <button className="mph-btn mph-btn-print no-print" onClick={() => setShowPrint(true)}>🖨 Imprimir</button>
        <button className="mph-btn mph-btn-print no-print" onClick={() => setShowPrint(true)} style={{ background: '#fef2f2', color: '#dc2626' }}>📄 PDF</button>
        <button className={`mph-btn ${showForm ? 'mph-btn-cancel' : 'mph-btn-primary'} no-print`} onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? '✕ Cancelar' : '+ Nuevo módulo'}
        </button>
      </PremiumHeader>

      {showForm && (
        <div className="mph-form-card no-print">
          <div className="mph-form-title">{editingId ? '✏️ Editar módulo' : '✨ Nuevo módulo'}</div>
          {(createError || updateError) && <div className="mph-form-error">{createError || updateError}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
              <Input label="Código" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Ej: MOD-001" required disabled={!!editingId} />
              <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Gestión de Usuarios" required />
            </div>
            {editingId && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ accentColor: 'var(--color-primary)' }} />
                Activo
              </label>
            )}
            <Button variant="success-soft" onClick={editingId ? handleUpdate : handleCreate} loading={creating || updating}>
              {editingId ? 'Guardar cambios' : 'Crear módulo'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="modules-empty"><div className="modules-empty-icon">⏳</div><div className="modules-empty-text">Cargando módulos...</div></div>
      ) : data.length === 0 ? (
        <div className="modules-empty"><div className="modules-empty-icon">📭</div><div className="modules-empty-text">No hay módulos registrados</div></div>
      ) : (
        <div className="modules-grid">
          {data.map((m) => (
            <div key={m.id} className={`m-card ${!m.active ? 'inactive' : ''}`}>
              <div className="m-card-top">
                <div className="m-card-icon">{moduleIcon(m.code)}</div>
                <div className="m-card-info">
                  <span className="m-card-code">{m.code}</span>
                  <div className="m-card-name">{m.name}</div>
                  <div className="m-card-desc">{moduleDescription(m.code)}</div>
                </div>
              </div>
              <div className="m-card-footer no-print">
                <div className="m-card-status">
                  <span className={`m-card-status-dot ${m.active ? 'active' : 'inactive'}`} />
                  {m.active ? 'Activo' : 'Inactivo'}
                </div>
                <div className="m-card-actions">
                  <button className="m-card-btn m-card-btn-edit" onClick={() => startEdit(m)}>Editar</button>
                  <button className="m-card-btn m-card-btn-del" onClick={() => del(m.id).then(() => reload())} disabled={deleting}>Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
