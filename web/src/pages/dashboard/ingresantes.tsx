import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiCreate, extractErrorMessage } from '../../hooks/use-api';
import { useCan } from '../../hooks/use-can';
import apiClient from '../../api/client';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { LEVEL_CATALOG } from '../../constants/levels';

// ── Types ────────────────────────────────────────────────────────────────────

interface Institution { id: string; name: string; }

interface Ingresante {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  birthDate: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  cycleId: string | null;
  level: string;
  status: string;
}

interface AcademicCycle {
  uuid: string;
  code: string;
  name: string;
}

interface CreateIngresanteBody {
  firstName: string;
  lastName: string;
  dni: string;
  birthDate?: string;
  address?: string;
  phone?: string;
  email?: string;
  cycleId?: string;
  level: string;
  institutionId?: string;
}

// ── Status badge map ─────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  INSCRIPTO:     { bg: '#fef9c3', color: '#92400e', label: 'Inscripto' },
  PAGO_MATRICULA:{ bg: '#dbeafe', color: '#1e40af', label: 'Pago matrícula' },
  ACEPTADO:      { bg: '#dcfce7', color: '#166534', label: 'Aceptado' },
  INGRESO:       { bg: '#f3e8ff', color: '#6b21a8', label: 'Ingresó' },
  NO_INGRESARA:  { bg: '#fee2e2', color: '#b91c1c', label: 'No ingresará' },
};

const NEXT_STATUS: Record<string, string> = {
  INSCRIPTO: 'PAGO_MATRICULA',
  PAGO_MATRICULA: 'ACEPTADO',
};

// ── Page component ───────────────────────────────────────────────────────────

export default function IngresantesPage() {
  const { can } = useCan();
  const { user } = useAuth();
  const { config } = useInstitution();
  const roles: string[] = user?.roles ?? [];
  const isRoot = roles.includes('ROOT');
  // D3: ROOT and ADMIN can choose any level; others have a fixed level
  const isAllLevels = isRoot || roles.includes('ADMIN');

  // Pre-compute the fixed level entry for non-ROOT/ADMIN users
  const userBaseLevel = user?.userLevels?.[0]?.level ?? null;
  const derivedLevelEntry = (!isAllLevels && userBaseLevel != null)
    ? (LEVEL_CATALOG.find(e => e.levelCode === userBaseLevel && e.modalityCode === 0) ?? null)
    : null;
  const derivedLevelName = derivedLevelEntry?.name ?? '';

  const userInstitutionId = user?.institutionId ?? config.id ?? '';
  const [institutionId, setInstitutionId] = useState(userInstitutionId);
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  useEffect(() => {
    apiClient.get('/institutions').then(r => {
      setInstitutions(r.data?.data ?? []);
    }).catch(() => {});
  }, []);

  const { data, loading, reload } = useApiList<Ingresante>('/ingresantes', institutionId ? { institutionId } : undefined);

  const [showAll, setShowAll] = useState(false);
  const displayData = showAll
    ? data
    : data.filter(i => ['INSCRIPTO', 'PAGO_MATRICULA', 'ACEPTADO'].includes(i.status));

  // ── Create form ──────────────────────────────────────────────────────────

  const { creating, createError, create, setCreateError } =
    useApiCreate<CreateIngresanteBody>('/ingresantes', institutionId ? { institutionId } : undefined);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateIngresanteBody>({
    firstName: '', lastName: '', dni: '', level: '',
  });

  // F-1: for non-ROOT/ADMIN, auto-set the fixed level whenever user changes
  useEffect(() => {
    if (isAllLevels || !derivedLevelName) return;
    setForm(f => ({ ...f, level: derivedLevelName, cycleId: undefined }));
  }, [derivedLevelName, isAllLevels]);

  // F-2: fetch cycles filtered by the resolved level; re-fetch when level changes
  const [cycles, setCycles] = useState<AcademicCycle[]>([]);
  useEffect(() => {
    const levelEntry = LEVEL_CATALOG.find(e => e.name === form.level);
    if (!levelEntry) {
      if (!isAllLevels) {
        // Non-ROOT/ADMIN without a resolved level — wait until level is set
        setCycles([]);
        return;
      }
      // ROOT/ADMIN with no level chosen yet — show all cycles for browsing
    }
    const params: Record<string, string> = { limit: '100' };
    if (levelEntry) params.level = String(levelEntry.levelCode);
    apiClient
      .get('/academic-cycles', { params })
      .then(r => setCycles(r.data?.data ?? []))
      .catch(() => {});
  }, [form.level, isAllLevels]);

  const handleCreate = async () => {
    setCreateError('');
    // F-3: both level and cycleId are now required
    if (!form.firstName.trim() || !form.lastName.trim() || !form.dni.trim() || !form.level || !form.cycleId) {
      setCreateError('Nombre, apellido, DNI, nivel y ciclo lectivo son requeridos');
      return;
    }
    const body: CreateIngresanteBody = {
      firstName: form.firstName,
      lastName: form.lastName,
      dni: form.dni,
      level: form.level,
      cycleId: form.cycleId,  // always include — now required by backend
    };
    if (form.birthDate)  body.birthDate  = form.birthDate;
    if (form.address)    body.address    = form.address;
    if (form.phone)      body.phone      = form.phone;
    if (form.email)      body.email      = form.email;
    if (institutionId)   body.institutionId = institutionId;

    const ok = await create(body);
    if (ok) {
      setShowForm(false);
      // For non-ROOT/ADMIN keep the fixed level; for ROOT/ADMIN reset to empty
      setForm({ firstName: '', lastName: '', dni: '', level: isAllLevels ? '' : derivedLevelName });
      reload();
    }
  };

  // ── Status actions ───────────────────────────────────────────────────────

  const [statusError, setStatusError] = useState<string>('');

  const handleAdvanceStatus = async (id: string, nextStatus: string) => {
    setStatusError('');
    try {
      await apiClient.patch(`/ingresantes/${id}/status`, { status: nextStatus });
      reload();
    } catch (err: unknown) {
      setStatusError(extractErrorMessage(err));
    }
  };

  const handleNoIngresara = async (id: string) => {
    setStatusError('');
    try {
      await apiClient.patch(`/ingresantes/${id}/status`, { status: 'NO_INGRESARA' });
      reload();
    } catch (err: unknown) {
      setStatusError(extractErrorMessage(err));
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <PremiumHeader
        title="Ingresantes"
        icon="📋"
        stats={[{ label: 'ingresantes', value: String(displayData.length) }]}
      >
        <Button variant="ghost" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Ver pendientes' : 'Ver todos'}
        </Button>
        {can('ENROLLMENTS', 'CREATE') && (
          <Button
            variant={showForm ? 'danger-soft' : 'success-soft'}
            onClick={() => {
              setShowForm(!showForm);
              setCreateError('');
            }}
          >
            {showForm ? 'Cancelar' : 'Nuevo ingresante'}
          </Button>
        )}
      </PremiumHeader>

      {/* ── Institution selector ─────────────────────────────── */}
      <div className="flex gap-md items-center" style={{ marginBottom: 'var(--space-md)' }}>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Institución</label>
          {isRoot ? (
            <select
              value={institutionId}
              onChange={e => setInstitutionId(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            >
              <option value="">Todas las instituciones</option>
              {institutions.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={institutions.find(i => i.id === institutionId)?.name || config.name || institutionId}
              disabled
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            />
          )}
        </div>
      </div>

      {/* ── Create form ──────────────────────────────────────── */}
      <Modal
        open={showForm && can('ENROLLMENTS', 'CREATE')}
        title="Nuevo ingresante"
        onClose={() => setShowForm(false)}
      >
          {createError && (
            <div style={{
              background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem',
              borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)',
            }}>
              {createError}
            </div>
          )}
          <div className="flex flex-col gap-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input
                label="Nombre"
                name="firstName"
                value={form.firstName}
                onChange={e => setForm({ ...form, firstName: e.target.value })}
                required
              />
              <Input
                label="Apellido"
                name="lastName"
                value={form.lastName}
                onChange={e => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
            <Input
              label="DNI"
              name="dni"
              value={form.dni}
              onChange={e => setForm({ ...form, dni: e.target.value })}
              required
            />
            <Input
              label="Fecha de nacimiento"
              name="birthDate"
              type="date"
              value={form.birthDate ?? ''}
              onChange={e => setForm({ ...form, birthDate: e.target.value })}
            />
            <Input
              label="Dirección"
              name="address"
              value={form.address ?? ''}
              onChange={e => setForm({ ...form, address: e.target.value })}
            />
            <Input
              label="Teléfono"
              name="phone"
              value={form.phone ?? ''}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email ?? ''}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />

            {/* F-1: Nivel — dropdown for ROOT/ADMIN, read-only for others */}
            <div className="field">
              <label htmlFor="nivel-select" className="field-label">Nivel</label>
              {isAllLevels ? (
                <select
                  id="nivel-select"
                  className="input"
                  value={form.level}
                  onChange={e => setForm({ ...form, level: e.target.value })}
                  required
                >
                  <option value="">Seleccioná un nivel</option>
                  {LEVEL_CATALOG.filter(l => l.pedagogical).map(l => (
                    <option key={l.code} value={l.name}>{l.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="nivel-select"
                  type="text"
                  value={derivedLevelEntry?.label ?? form.level}
                  disabled
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', width: '100%' }}
                />
              )}
            </div>

            {/* F-2: Ciclo lectivo — filtered by resolved level, required */}
            <div className="field">
              <label htmlFor="ciclo-select" className="field-label">Ciclo lectivo</label>
              <select
                id="ciclo-select"
                className="input"
                value={form.cycleId ?? ''}
                onChange={e => setForm({ ...form, cycleId: e.target.value || undefined })}
                required
              >
                <option value="">Seleccioná un ciclo lectivo (requerido)</option>
                {cycles.map(c => (
                  <option key={c.uuid} value={c.uuid}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <Button variant="success-soft" onClick={handleCreate} loading={creating}>
                Crear ingresante
              </Button>
              <Button variant="danger-soft" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </div>
      </Modal>

      {/* ── Status transition error ───────────────────────────── */}
      {statusError && (
        <div style={{
          background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem',
          borderRadius: 'var(--radius-md)', marginTop: 'var(--space-sm)', fontSize: 'var(--text-sm)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{statusError}</span>
          <button
            onClick={() => setStatusError('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── List ─────────────────────────────────────────────── */}
      <div style={{ marginTop: 'var(--space-lg)' }}>
        {loading && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-md)' }}>
            Cargando...
          </p>
        )}
        {!loading && displayData.length === 0 && (
          <Card>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              No hay ingresantes{showAll ? '' : ' pendientes'}.
            </p>
          </Card>
        )}
        {!loading && displayData.map(ingresante => {
          const badge = STATUS_BADGE[ingresante.status] ?? STATUS_BADGE.INSCRIPTO;
          const nextStatus = NEXT_STATUS[ingresante.status];
          const isTerminal = ingresante.status === 'INGRESO' || ingresante.status === 'NO_INGRESARA';

          return (
            <Card key={ingresante.id} className="mt-sm">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                    <span style={{
                      background: badge.bg, color: badge.color,
                      padding: '0.15rem 0.6rem', borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--text-xs)', fontWeight: 600,
                    }}>
                      {badge.label}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                      {ingresante.lastName}, {ingresante.firstName}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                      DNI: {ingresante.dni}
                    </span>
                  </div>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', margin: 0 }}>
                    Nivel: {ingresante.level}
                    {ingresante.email && ` · ${ingresante.email}`}
                    {ingresante.phone && ` · ${ingresante.phone}`}
                  </p>
                </div>

                {can('ENROLLMENTS', 'UPDATE') && !isTerminal && (
                  <div style={{ display: 'flex', gap: 'var(--space-xs)', flexShrink: 0 }}>
                    {nextStatus && (
                      <Button
                        variant="success-soft"
                        size="sm"
                        onClick={() => handleAdvanceStatus(ingresante.id, nextStatus)}
                      >
                        Avanzar
                      </Button>
                    )}
                    <Button
                      variant="danger-soft"
                      size="sm"
                      onClick={() => handleNoIngresara(ingresante.id)}
                    >
                      No ingresará
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
