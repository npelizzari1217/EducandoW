import { useState, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import { useApiList, useApiDelete, useApiCreate } from '../../hooks/use-api';
import apiClient from '../../api/client';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

interface InstitutionRow {
  id: string;
  name: string;
  cue: string | null;
  city: string | null;
  country: string | null;
  active: boolean;
  levels: string[];
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
  levels: string[];
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
  levels: ['INICIAL'],
};

const LEVELS = ['INICIAL', 'PRIMARIO', 'SECUNDARIO', 'TERCIARIO'] as const;
const SMTP_ENCRYPTIONS = ['', 'TLS', 'SSL', 'NONE'] as const;

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

function SectionHeader({ title, expanded, onToggle, children }: { title: string; expanded: boolean; onToggle: () => void; children?: React.ReactNode }) {
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

  const toggleLevel = (l: string) =>
    setForm((f) => ({
      ...f,
      levels: f.levels.includes(l) ? f.levels.filter((x) => x !== l) : [...f.levels, l],
    }));

  const update = (field: keyof InstitutionForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const validateForm = useCallback((): string | null => {
    if (!form.name.trim()) return 'El nombre es obligatorio';
    if (form.levels.length === 0) return 'Debe seleccionar al menos un nivel';
    if (form.header_color && !HEX_REGEX.test(form.header_color)) return 'header_color debe ser hex válido (#RRGGBB)';
    if (form.header_text_color && !HEX_REGEX.test(form.header_text_color)) return 'header_text_color debe ser hex válido (#RRGGBB)';
    if (form.body_text_color && !HEX_REGEX.test(form.body_text_color)) return 'body_text_color debe ser hex válido (#RRGGBB)';
    if (form.smtp_port && (isNaN(Number(form.smtp_port)) || Number(form.smtp_port) < 1 || Number(form.smtp_port) > 65535)) return 'smtp_port debe ser entre 1 y 65535';
    if (form.socket_port && (isNaN(Number(form.socket_port)) || Number(form.socket_port) < 1 || Number(form.socket_port) > 65535)) return 'socket_port debe ser entre 1 y 65535';
    return null;
  }, [form]);

  const buildPayload = useCallback(() => {
    const p: Record<string, unknown> = {
      name: form.name.trim(),
      levels: form.levels,
      country: form.country || 'AR',
      send_email: form.send_email,
      send_messages: form.send_messages,
    };
    // Optional string fields — only include if non-empty
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
    // Numeric fields
    if (form.smtp_port.trim()) p['smtp_port'] = Number(form.smtp_port);
    if (form.socket_port.trim()) p['socket_port'] = Number(form.socket_port);
    return p;
  }, [form]);

  const handleCreate = async () => {
    const err = validateForm();
    if (err) { setCreateError(err); return; }
    const ok = await create(buildPayload());
    if (ok) { setShowForm(false); setForm(EMPTY_FORM); reload(); }
  };

  const handleEdit = async (row: InstitutionRow) => {
    // Load full institution data and open form for editing
    setEditingId(row.id);
    setSaveError('');
    try {
      const { data: res } = await apiClient.get(`/institutions/${row.id}`);
      const inst = res.data;
      if (inst) {
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
          levels: inst.levels ?? ['INICIAL'],
        });
        setShowForm(true);
        setSections({ identificacion: true, contacto: true, branding: true, smtp: true, notificaciones: true });
      }
    } catch (e: any) {
      setSaveError('Error al cargar datos de la institución');
    }
  };

  const handleSave = async () => {
    if (!editingId) return;
    const err = validateForm();
    if (err) { setSaveError(err); return; }
    setSaving(true); setSaveError('');
    try {
      await apiClient.patch(`/institutions/${editingId}`, buildPayload());
      setShowForm(false); setForm(EMPTY_FORM); setEditingId(null);
      reload();
    } catch (e: any) {
      setSaveError(e?.response?.data?.message ?? 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Instituciones</h1>
          <p className="page-subtitle">Gestioná las instituciones educativas</p>
        </div>
        {user?.role === 'ADMIN' && (
          <Button onClick={() => { setShowForm(!showForm); if (!showForm) { setForm(EMPTY_FORM); setEditingId(null); setSaveError(''); setCreateError(''); } }}>
            {showForm ? 'Cancelar' : 'Nueva institución'}
          </Button>
        )}
      </div>

      {showForm && (
        <Card title={editingId ? 'Editar institución' : 'Nueva institución'} className="mt-md">
          {(createError || saveError) && (
            <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
              {createError || saveError}
            </div>
          )}

          {/* ── Identificación ── */}
          <SectionHeader title="Identificación" expanded={sections.identificacion} onToggle={() => toggleSection('identificacion')} />
          {sections.identificacion && (
            <div className="flex flex-col gap-md" style={{ marginBottom: 'var(--space-lg)' }}>
              <Input label="Nombre *" value={form.name} onChange={(e) => update('name', e.target.value)} required />
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
              <Input label="URL del Logo" value={form.logo_url} onChange={(e) => update('logo_url', e.target.value)} placeholder="https://cdn.example.com/logo.png" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="field">
                  <label className="field-label">Color Header</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="color" value={form.header_color || '#000000'} onChange={(e) => update('header_color', e.target.value)} style={{ width: 40, height: 36, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
                    <input className="input" value={form.header_color} onChange={(e) => update('header_color', e.target.value)} placeholder="#1a56db" style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Color Texto Header</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="color" value={form.header_text_color || '#ffffff'} onChange={(e) => update('header_text_color', e.target.value)} style={{ width: 40, height: 36, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
                    <input className="input" value={form.header_text_color} onChange={(e) => update('header_text_color', e.target.value)} placeholder="#ffffff" style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Color Texto</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="color" value={form.body_text_color || '#333333'} onChange={(e) => update('body_text_color', e.target.value)} style={{ width: 40, height: 36, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
                    <input className="input" value={form.body_text_color} onChange={(e) => update('body_text_color', e.target.value)} placeholder="#333333" style={{ flex: 1 }} />
                  </div>
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
                <Input label="Puerto SMTP" value={form.smtp_port} onChange={(e) => update('smtp_port', e.target.value)} placeholder="587" type="number" />
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
                <Input label="Puerto WebSocket" value={form.socket_port} onChange={(e) => update('socket_port', e.target.value)} type="number" />
              </div>
            </div>
          )}

          {/* ── Niveles ── */}
          <div style={{ borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-md)', padding: '0.5rem 0', fontWeight: 600, fontSize: 'var(--text-base)' }}>
            Niveles educativos
          </div>
          <div className="field">
            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
              {LEVELS.map((l) => (
                <label key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.levels.includes(l)} onChange={() => toggleLevel(l)} />{l}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-lg)', display: 'flex', gap: 'var(--space-md)' }}>
            {editingId ? (
              <Button onClick={handleSave} loading={saving}>Guardar cambios</Button>
            ) : (
              <Button onClick={handleCreate} loading={creating}>Crear institución</Button>
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
            { key: 'levels', header: 'Niveles', render: (i: Record<string, unknown>) => String((i.levels as string[])?.join(', ') ?? '—') },
            {
              key: 'actions',
              header: '',
              render: (i: Record<string, unknown>) =>
                user?.role === 'ADMIN' ? (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(i as unknown as InstitutionRow)}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => del(i.id as string).then(() => reload())} loading={deleting}>Eliminar</Button>
                  </div>
                ) : null,
            },
          ]}
          data={data as unknown as Record<string, unknown>[]}
          emptyMessage={loading ? 'Cargando...' : 'No hay instituciones'}
        />
      </Card>
    </div>
  );
}
