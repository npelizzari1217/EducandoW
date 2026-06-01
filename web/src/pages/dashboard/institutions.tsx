import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../../context/auth-context';
import { useApiList, useApiDelete, useApiCreate, extractErrorMessage } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import apiClient from '../../api/client';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { PEDAGOGICAL_LEVELS, LEVEL_LABELS } from '@/constants/levels';
import type { LevelOption } from '@/constants/levels';

interface InstitutionLevelEntry {
  level: number | string;  // API returns number; frontend sends string (Zod DTO expects string)
  modality: number | string;
}

interface InstitutionRow {
  id: string;
  name: string;
  cue: string | null;
  city: string | null;
  country: string | null;
  active: boolean;
  levels: number[];
  institution_levels?: InstitutionLevelEntry[];
}

interface InstitutionForm {
  name: string;
  cue: string;
  ministry_reg: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
  website: string;
  contact_email: string;
  logo_url: string;
  header_color: string;
  header_text_color: string;
  body_text_color: string;
  smtp_host: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_encryption: string;
  smtp_port: string;
  send_email: boolean;
  send_messages: boolean;
  socket_host: string;
  socket_port: string;
  // Track selected level options by their index in PEDAGOGICAL_LEVELS
  selectedLevels: Set<number>; // indexes into PEDAGOGICAL_LEVELS
}

type FieldErrors = Partial<Record<keyof InstitutionForm, string>>;

// ── Conversión niveles ──

/** Convert PEDAGOGICAL_LEVELS indices → institution_levels payload */
function indicesToInstitutionLevels(indices: Set<number>): InstitutionLevelEntry[] {
  return Array.from(indices).map((i) => {
    const opt = PEDAGOGICAL_LEVELS[i];
    return { level: String(opt.levelCode), modality: String(opt.modalityCode) };
  });
}

/** Find PEDAGOGICAL_LEVELS indices from institution_levels (new format) */
function institutionLevelsToIndices(levels: InstitutionLevelEntry[]): Set<number> {
  const indices = new Set<number>();
  for (const il of levels) {
    const idx = PEDAGOGICAL_LEVELS.findIndex(
      (opt) => opt.levelCode === Number(il.level) && opt.modalityCode === Number(il.modality),
    );
    if (idx !== -1) indices.add(idx);
  }
  return indices;
}

/** Convert legacy number[] codes → PEDAGOGICAL_LEVELS indices */
function codesToIndices(codes: number[]): Set<number> {
  const indices = new Set<number>();
  for (const c of codes) {
    const idx = PEDAGOGICAL_LEVELS.findIndex((opt) => opt.code === c);
    if (idx !== -1) indices.add(idx);
  }
  return indices;
}

const EMPTY_FORM: InstitutionForm = {
  name: '',
  cue: '',
  ministry_reg: '',
  address: '',
  city: '',
  postal_code: '',
  country: 'AR',
  phone: '',
  website: '',
  contact_email: '',
  logo_url: '',
  header_color: '',
  header_text_color: '',
  body_text_color: '',
  smtp_host: '',
  smtp_user: '',
  smtp_pass: '',
  smtp_encryption: '',
  smtp_port: '',
  send_email: false,
  send_messages: false,
  socket_host: '',
  socket_port: '',
  selectedLevels: new Set<number>([0]), // Default: INICIAL (index 0)
};

const SMTP_ENCRYPTIONS = ['', 'TLS', 'SSL', 'NONE'] as const;
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

function SectionHeader({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-md)' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', background: 'none', border: 'none', padding: '0.5rem 0',
          display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
          fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)',
        }}
      >
        <span style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
        {title}
      </button>
    </div>
  );
}

export default function InstitutionsPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useApiList<InstitutionRow>('/institutions');
  const { deleting, del } = useApiDelete('/institutions');
  const { creating, createError, create, setCreateError } = useApiCreate('/institutions');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<InstitutionForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<InstitutionRow | null>(null);
  const [printing, setPrinting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [imgFailed, setImgFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isRoot = user?.roles?.includes('ROOT') ?? false;
  const userModules = user?.modules ?? [];
  const hasModuleAction = (moduleCode: string, ...actions: string[]) =>
    isRoot || userModules.some(m => m.moduleCode === moduleCode && actions.some(a => m.actions.includes(a)));

  // Collapsible section state
  const [sections, setSections] = useState({
    identificacion: true,
    contacto: true,
    branding: false,
    smtp: false,
    notificaciones: false,
  });

  const toggleSection = (key: keyof typeof sections) =>
    setSections((s) => ({ ...s, [key]: !s[key] }));

  /** Resuelve la URL del logo. En dev usa el proxy, en prod usa VITE_API_URL. */
  const resolveLogoUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    // Path local: en dev el proxy maneja /uploads, en prod usa el host de la API
    const apiBase = (import.meta.env.VITE_API_URL as string) || '';
    if (apiBase && apiBase.startsWith('http')) {
      const host = apiBase.replace(/\/v1\/?$/, '');
      return `${host}${url}`;
    }
    return url; // dev: proxy handles it, prod same-origin
  };

  // Resetear imgFailed cuando cambia la URL del logo
  const prevLogoRef = useRef(form.logo_url);
  if (prevLogoRef.current !== form.logo_url) {
    prevLogoRef.current = form.logo_url;
    if (imgFailed) setImgFailed(false);
  }

  const toggleLevel = (optIndex: number) =>
    setForm((f) => {
      const next = new Set(f.selectedLevels);
      if (next.has(optIndex)) {
        next.delete(optIndex);
      } else {
        next.add(optIndex);
      }
      return { ...f, selectedLevels: next };
    });

  const update = (field: keyof InstitutionForm, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  };

  const validateForm = useCallback((): boolean => {
    const errs: FieldErrors = {};
    if (!form.name.trim()) errs.name = 'El nombre es obligatorio';
    if (form.selectedLevels.size === 0) errs.selectedLevels = 'Seleccioná al menos un nivel educativo para que los módulos de Secretarios y Académico funcionen correctamente';
    if (form.header_color && !HEX_REGEX.test(form.header_color)) errs.header_color = 'Debe ser un hex válido (#RRGGBB)';
    if (form.header_text_color && !HEX_REGEX.test(form.header_text_color)) errs.header_text_color = 'Debe ser un hex válido (#RRGGBB)';
    if (form.body_text_color && !HEX_REGEX.test(form.body_text_color)) errs.body_text_color = 'Debe ser un hex válido (#RRGGBB)';
    if (form.smtp_port && (isNaN(Number(form.smtp_port)) || Number(form.smtp_port) < 1 || Number(form.smtp_port) > 65535)) errs.smtp_port = 'Debe ser entre 1 y 65535';
    if (form.socket_port && (isNaN(Number(form.socket_port)) || Number(form.socket_port) < 1 || Number(form.socket_port) > 65535)) errs.socket_port = 'Debe ser entre 1 y 65535';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  const handleLogoUpload = async (institutionId: string, file: File) => {
    setUploadingLogo(true);
    setLogoError('');
    setImgFailed(false);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await apiClient.post(`/institutions/${institutionId}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const publicPath = data?.data?.publicPath;
      if (publicPath) {
        setForm((f) => ({ ...f, logo_url: publicPath }));
      } else {
        setLogoError('El servidor no devolvió la ruta del logo');
      }
    } catch (e: unknown) {
      const msg = extractErrorMessage(e);
      setLogoError(msg || 'Error al subir el logo. Verificá el formato y tamaño.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const buildPayload = useCallback(() => {
    const p: Record<string, unknown> = {
      name: form.name.trim(),
      institution_levels: indicesToInstitutionLevels(form.selectedLevels),
      country: form.country || 'AR',
      send_email: form.send_email,
      send_messages: form.send_messages,
    };
    const optionalStrings: (keyof InstitutionForm)[] = [
      'cue', 'ministry_reg', 'address', 'city', 'postal_code',
      'phone', 'website', 'contact_email', 'logo_url',
      'header_color', 'header_text_color', 'body_text_color',
      'smtp_host', 'smtp_user', 'smtp_pass', 'smtp_encryption',
      'socket_host',
    ];
    for (const key of optionalStrings) {
      const v = form[key];
      if (typeof v === 'string' && v.trim()) p[key] = v.trim();
    }
    if (form.smtp_port.trim()) p['smtp_port'] = Number(form.smtp_port);
    if (form.socket_port.trim()) p['socket_port'] = Number(form.socket_port);
    return p;
  }, [form]);

  const handleCreate = async () => {
    if (!validateForm()) return;
    const ok = await create(buildPayload());
    if (ok) { setShowForm(false); setForm(EMPTY_FORM); setFieldErrors({}); reload(); }
  };

  const handleEdit = async (row: InstitutionRow) => {
    setEditingId(row.id);
    setSaveError('');
    setFieldErrors({});
    try {
      const { data: res } = await apiClient.get(`/institutions/${row.id}`);
      const inst = res.data;
      if (inst) {
        // Use new institution_levels if present, else fallback to legacy levels
        let selectedIndices: Set<number>;
        if (inst.institution_levels?.length) {
          selectedIndices = institutionLevelsToIndices(inst.institution_levels);
        } else if (inst.levels?.length) {
          selectedIndices = codesToIndices(inst.levels);
        } else {
          selectedIndices = new Set<number>();
        }

        setForm({
          name: inst.name ?? '',
          cue: inst.cue ?? '',
          ministry_reg: inst.ministry_reg ?? '',
          address: inst.address ?? '',
          city: inst.city ?? '',
          postal_code: inst.postal_code ?? '',
          country: inst.country ?? 'AR',
          phone: inst.phone ?? '',
          website: inst.website ?? '',
          contact_email: inst.contact_email ?? '',
          logo_url: inst.logo_url ?? '',
          header_color: inst.header_color ?? '',
          header_text_color: inst.header_text_color ?? '',
          body_text_color: inst.body_text_color ?? '',
          smtp_host: inst.smtp_host ?? '',
          smtp_user: inst.smtp_user ?? '',
          smtp_pass: '',
          smtp_encryption: inst.smtp_encryption ?? '',
          smtp_port: inst.smtp_port != null ? String(inst.smtp_port) : '',
          send_email: inst.send_email ?? false,
          send_messages: inst.send_messages ?? false,
          socket_host: inst.socket_host ?? '',
          socket_port: inst.socket_port != null ? String(inst.socket_port) : '',
          selectedLevels: selectedIndices,
        });
        setShowForm(true);
        setSections({ identificacion: true, contacto: true, branding: true, smtp: true, notificaciones: true });
      }
    } catch (e: unknown) {
      setSaveError(extractErrorMessage(e) || 'Error al cargar datos de la institución');
    }
  };

  const handleSave = async () => {
    if (!editingId) return;
    if (!validateForm()) return;
    setSaving(true); setSaveError('');
    try {
      await apiClient.patch(`/institutions/${editingId}`, buildPayload());
      setShowForm(false); setForm(EMPTY_FORM); setEditingId(null); setFieldErrors({});
      reload();
    } catch (e: unknown) {
      setSaveError(extractErrorMessage(e) || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handlePrint = async (row: InstitutionRow) => {
    setPrinting(true);
    try {
      const { data: res } = await apiClient.get(`/institutions/${row.id}/print`);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const content = `
          <html>
            <head><title>Imprimir — ${row.name}</title></head>
            <body>
              <pre>${JSON.stringify(res.data, null, 2)}</pre>
            </body>
          </html>`;
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (e: unknown) {
      setSaveError(extractErrorMessage(e) || 'Error al imprimir');
    } finally { setPrinting(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const success = await del(deleteTarget.id);
    if (success) {
      setDeleteTarget(null);
      alert(`Institución "${deleteTarget.name}" eliminada correctamente.`);
      reload();
    } else {
      setDeleteTarget(null);
      alert('Error al eliminar la institución. Intentá de nuevo.');
    }
  };

  const errorMessage = createError || saveError;

  const clearForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setSaveError('');
    setCreateError('');
    setFieldErrors({});
  };

  return (
    <div>
      <PremiumHeader
        title="Instituciones"
        subtitle="Gestioná las instituciones educativas"
        icon="🏛"
        stats={[{ label: 'instituciones', value: String(data.length) }]}
      >
        {hasModuleAction('INSTITUTIONS', 'CREATE') && (
          <Button
            variant={showForm ? 'danger-soft' : 'success-soft'}
            onClick={() => {
              if (showForm) { clearForm(); }
              else { setShowForm(true); setForm(EMPTY_FORM); setEditingId(null); setSaveError(''); setCreateError(''); setFieldErrors({}); }
            }}
          >
            {showForm ? 'Cancelar' : 'Nueva institución'}
          </Button>
        )}
      </PremiumHeader>

      {showForm && (
        <Card title={editingId ? 'Editar institución' : 'Nueva institución'} className="mt-md">
          {errorMessage && (
            <div style={{
              background: 'var(--color-danger-light)',
              color: 'var(--color-danger)',
              padding: 'var(--space-sm)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-md)',
              fontSize: 'var(--text-sm)',
            }}>
              {errorMessage}
            </div>
          )}

          {/* ── Identificación ── */}
          <SectionHeader title="Identificación" expanded={sections.identificacion} onToggle={() => toggleSection('identificacion')} />
          {sections.identificacion && (
            <div className="flex flex-col gap-md" style={{ marginBottom: 'var(--space-lg)' }}>
              <Input label="Nombre *" value={form.name} onChange={(e) => update('name', e.target.value)} required error={fieldErrors.name} />
              <Input label="CUE" value={form.cue} onChange={(e) => update('cue', e.target.value)} placeholder="Código Único Escolar" />
              <Input label="N° Registro Ministerio" value={form.ministry_reg} onChange={(e) => update('ministry_reg', e.target.value)} />
            </div>
          )}

          {/* ── Contacto ── */}
          <SectionHeader title="Contacto" expanded={sections.contacto} onToggle={() => toggleSection('contacto')} />
          {sections.contacto && (
            <div className="flex flex-col gap-md" style={{ marginBottom: 'var(--space-lg)' }}>
              <Input label="Dirección" value={form.address} onChange={(e) => update('address', e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <Input label="Ciudad" value={form.city} onChange={(e) => update('city', e.target.value)} />
                <Input label="Código Postal" value={form.postal_code} onChange={(e) => update('postal_code', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <Input label="País (ISO)" value={form.country} onChange={(e) => update('country', e.target.value)} placeholder="AR" maxLength={2} />
                <Input label="Teléfono" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
              </div>
              <Input label="Sitio Web" value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://..." />
              <Input label="Email de Contacto" type="email" value={form.contact_email} onChange={(e) => update('contact_email', e.target.value)} />
            </div>
          )}

          {/* ── Branding ── */}
          <SectionHeader title="Branding" expanded={sections.branding} onToggle={() => toggleSection('branding')} />
          {sections.branding && (
            <div className="flex flex-col gap-md" style={{ marginBottom: 'var(--space-lg)' }}>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>Logo de la Institución</label>

                {/* Fila: preview + botón */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.75rem' }}>
                  {/* Imagen con su propio recuadro */}
                  {form.logo_url && !imgFailed ? (
                    <img
                      key={form.logo_url}
                      src={resolveLogoUrl(form.logo_url)}
                      alt="Logo de la institución"
                      style={{
                        width: 96, height: 96, flexShrink: 0,
                        objectFit: 'contain', borderRadius: 8,
                        border: '1px solid #e2e8f0', background: '#fff', padding: 4,
                      }}
                      onError={() => setImgFailed(true)}
                    />
                  ) : (
                    <div style={{
                      width: 96, height: 96, flexShrink: 0, borderRadius: 8,
                      border: form.logo_url ? '1px solid #fecaca' : '2px dashed #e2e8f0', background: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: form.logo_url ? '#dc2626' : '#94a3b8', fontSize: form.logo_url ? '1.5rem' : '2rem',
                    }}>
                      {form.logo_url ? '🖼' : '🏫'}
                    </div>
                  )}

                  {/* Texto + botón a la derecha */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center', minHeight: 96 }}>
                    {form.logo_url && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.15rem' }}>Logo actual</div>
                        <div style={{ wordBreak: 'break-all', maxWidth: 260 }}>{form.logo_url}</div>
                      </div>
                    )}
                    {!form.logo_url && (
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        Sin logo — subí uno o ingresá una URL
                      </div>
                    )}
                    {editingId && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && editingId) handleLogoUpload(editingId, file);
                            if (e.target) e.target.value = '';
                          }}
                        />
                        <Button
                          variant="action"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          loading={uploadingLogo}
                        >
                          {uploadingLogo ? 'Subiendo...' : '📁 Subir Logo'}
                        </Button>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          PNG, JPG, WebP, SVG — máx. 5 MB
                        </span>
                      </div>
                      {logoError && (
                        <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 500 }}>{logoError}</div>
                      )}
                    </div>
                    )}
                  </div>
                </div>
                <Input label="O ingresá una URL" value={form.logo_url} onChange={(e) => update('logo_url', e.target.value)} placeholder="https://cdn.example.com/logo.png" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="field">
                  <label className="field-label">Color Header</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="color" value={form.header_color || '#000000'} onChange={(e) => update('header_color', e.target.value)} style={{ width: 40, height: 36, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
                    <input className="input" value={form.header_color} onChange={(e) => update('header_color', e.target.value)} placeholder="#1a56db" style={{ flex: 1 }} />
                  </div>
                  {fieldErrors.header_color && <span className="field-error">{fieldErrors.header_color}</span>}
                </div>
                <div className="field">
                  <label className="field-label">Color Texto Header</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="color" value={form.header_text_color || '#ffffff'} onChange={(e) => update('header_text_color', e.target.value)} style={{ width: 40, height: 36, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
                    <input className="input" value={form.header_text_color} onChange={(e) => update('header_text_color', e.target.value)} placeholder="#ffffff" style={{ flex: 1 }} />
                  </div>
                  {fieldErrors.header_text_color && <span className="field-error">{fieldErrors.header_text_color}</span>}
                </div>
                <div className="field">
                  <label className="field-label">Color Texto</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="color" value={form.body_text_color || '#333333'} onChange={(e) => update('body_text_color', e.target.value)} style={{ width: 40, height: 36, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
                    <input className="input" value={form.body_text_color} onChange={(e) => update('body_text_color', e.target.value)} placeholder="#333333" style={{ flex: 1 }} />
                  </div>
                  {fieldErrors.body_text_color && <span className="field-error">{fieldErrors.body_text_color}</span>}
                </div>
              </div>
            </div>
          )}

          {/* ── SMTP ── */}
          <SectionHeader title="SMTP" expanded={sections.smtp} onToggle={() => toggleSection('smtp')} />
          {sections.smtp && (
            <div className="flex flex-col gap-md" style={{ marginBottom: 'var(--space-lg)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-md)' }}>
                <Input label="Host SMTP" value={form.smtp_host} onChange={(e) => update('smtp_host', e.target.value)} placeholder="smtp.gmail.com" />
                <Input label="Puerto SMTP" value={form.smtp_port} onChange={(e) => update('smtp_port', e.target.value)} placeholder="587" type="number" error={fieldErrors.smtp_port} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <Input label="Usuario SMTP" value={form.smtp_user} onChange={(e) => update('smtp_user', e.target.value)} />
                <Input label="Password SMTP" type="password" value={form.smtp_pass} onChange={(e) => update('smtp_pass', e.target.value)} placeholder="Dejar vacío para no modificar" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="field">
                  <label className="field-label">Encriptación SMTP</label>
                  <select className="input" value={form.smtp_encryption} onChange={(e) => update('smtp_encryption', e.target.value)} style={{ width: '100%' }}>
                    {SMTP_ENCRYPTIONS.map((v) => <option key={v} value={v}>{v || 'Ninguna'}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Envío de emails</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0' }}>
                    <input type="checkbox" checked={form.send_email} onChange={(e) => update('send_email', e.target.checked)} />
                    <span style={{ fontSize: 'var(--text-sm)' }}>{form.send_email ? 'Activado' : 'Desactivado'}</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Notificaciones ── */}
          <SectionHeader title="Notificaciones" expanded={sections.notificaciones} onToggle={() => toggleSection('notificaciones')} />
          {sections.notificaciones && (
            <div className="flex flex-col gap-md" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="field">
                <label className="field-label">Mensajería WebSocket</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0' }}>
                  <input type="checkbox" checked={form.send_messages} onChange={(e) => update('send_messages', e.target.checked)} />
                  <span style={{ fontSize: 'var(--text-sm)' }}>{form.send_messages ? 'Activado' : 'Desactivado'}</span>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-md)' }}>
                <Input label="Host WebSocket" value={form.socket_host} onChange={(e) => update('socket_host', e.target.value)} />
                <Input label="Puerto WebSocket" value={form.socket_port} onChange={(e) => update('socket_port', e.target.value)} type="number" error={fieldErrors.socket_port} />
              </div>
            </div>
          )}

          {/* ── Niveles ── */}
          <div style={{ borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-md)', padding: '0.5rem 0', fontWeight: 600, fontSize: 'var(--text-base)' }}>
            Niveles educativos
          </div>
          <div className="field">
            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
              {PEDAGOGICAL_LEVELS.map((opt: LevelOption, idx: number) => (
                <label key={opt.code} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.selectedLevels.has(idx)} onChange={() => toggleLevel(idx)} />{opt.label}
                </label>
              ))}
            </div>
            {fieldErrors.selectedLevels && <span className="field-error">{fieldErrors.selectedLevels}</span>}
          </div>

          <div style={{ marginTop: 'var(--space-lg)', display: 'flex', gap: 'var(--space-md)' }}>
            {editingId ? (
              <Button variant="success-soft" onClick={handleSave} loading={saving}>Guardar cambios</Button>
            ) : (
              <Button variant="success-soft" onClick={handleCreate} loading={creating}>Crear institución</Button>
            )}
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'name', header: 'Nombre' },
            { key: 'cue', header: 'CUE', render: (i: Record<string, unknown>) => (i.cue as string) ?? '—' },
            { key: 'country', header: 'País', render: (i: Record<string, unknown>) => (i.country as string) ?? '—' },
            {
              key: 'levels',
              header: 'Niveles',
              render: (i: Record<string, unknown>) => {
                const levels = i.levels as number[];
                return levels?.length ? levels.map((c) => LEVEL_LABELS[c] ?? c).join(', ') : '—';
              },
            },
            {
              key: 'actions',
              header: '',
              render: (i: Record<string, unknown>) => {
                const canEdit = hasModuleAction('INSTITUTIONS', 'READ', 'UPDATE');
                const canPrint = hasModuleAction('INSTITUTIONS', 'PRINT');
                const canDelete = hasModuleAction('INSTITUTIONS', 'DELETE');
                if (!canEdit) return null;
                const row = i as unknown as InstitutionRow;
                return (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <Button variant="action" size="sm" onClick={() => handleEdit(row)}>Editar</Button>
                    {canPrint && (
                      <Button variant="action" size="sm" onClick={() => handlePrint(row)} loading={printing}>Imprimir</Button>
                    )}
                    {canDelete && (
                      <Button variant="danger-soft" size="sm" onClick={() => setDeleteTarget(row)}>Eliminar</Button>
                    )}
                  </div>
                );
              },
            },
          ]}
          data={data as unknown as Record<string, unknown>[]}
          emptyMessage={loading ? 'Cargando...' : 'No hay instituciones'}
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
              ¿Estás seguro de que querés eliminar la institución <strong>{deleteTarget.name}</strong>?
            </p>
            <p style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Esta acción desactivará la institución pero no borrará sus datos.
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
