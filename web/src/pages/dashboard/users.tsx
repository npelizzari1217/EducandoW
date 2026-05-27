import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiDelete, useApiCreate, useApiUpdate } from '../../hooks/use-api';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import apiClient from '../../api/client';

// ── Tipos ─────────────────────────────────────────────────

interface UserRow {
  [key: string]: unknown;
  id: string;
  email: string;
  name: string;
  institutionId: string | null;
  institutionName: string | null;
  level: number | null;
  modality: number | null;
  roles: string[];
  active: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Institution {
  id: string;
  name: string;
}

// ── Constantes ────────────────────────────────────────────

/**
 * Jerarquía de roles: a mayor número, más poder.
 * Define quién puede gestionar a quién — INDEPENDIENTE del nivel educativo.
 */
const ROLE_HIERARCHY: Record<string, number> = {
  ROOT: 99,
  ADMIN: 60,
  DIRECTOR: 50,
  SECRETARIO: 40,
  PRECEPTOR: 30,
  TEACHER: 20,
  TUTOR: 10,
  STUDENT: 0,
};

const ROLE_LABELS: Record<string, string> = {
  ROOT: 'Root',
  ADMIN: 'Administrador',
  DIRECTOR: 'Directivo',
  SECRETARIO: 'Secretario',
  PRECEPTOR: 'Preceptor',
  TEACHER: 'Docente',
  TUTOR: 'Tutor',
  STUDENT: 'Alumno',
};

const LEVEL_LABELS: Record<number, string> = {
  1: 'Inicial', 2: 'Primario', 3: 'Secundario', 4: 'Terciario', 9: 'Administración',
};

const KNOWN_ROLES = ['ROOT', 'ADMIN', 'DIRECTOR', 'SECRETARIO', 'PRECEPTOR', 'TEACHER', 'TUTOR', 'STUDENT'];

// ── Helpers ───────────────────────────────────────────────

function getHighestRoleRank(roles: string[]): number {
  if (roles.length === 0) return -1;
  let highest = -1;
  for (const role of roles) {
    const rank = ROLE_HIERARCHY[role] ?? -1;
    if (rank > highest) highest = rank;
  }
  return highest;
}

function canManageUser(creatorRoles: string[], targetRoles: string[]): boolean {
  if (creatorRoles.includes('ROOT')) return true;
  const creatorRank = getHighestRoleRank(creatorRoles);
  const targetRank = getHighestRoleRank(targetRoles);
  if (creatorRank < 0) return false;
  return creatorRank > targetRank;
}

function levelLabel(code: number | null): string {
  if (code == null) return '-';
  return LEVEL_LABELS[code] ?? `Nivel ${code}`;
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function roleHierarchyLabel(roles: string[]): string {
  if (roles.length === 0) return 'Sin rol';
  const highest = roles.reduce((best, r) => {
    const rank = ROLE_HIERARCHY[r] ?? -1;
    const bestRank = ROLE_HIERARCHY[best] ?? -1;
    return rank > bestRank ? r : best;
  }, roles[0]);
  return `${roleLabel(highest)} (${ROLE_HIERARCHY[highest] ?? '?'})`;
}

// ── Componente ────────────────────────────────────────────

export default function UsersPage() {
  const { user } = useAuth();
  const { config } = useInstitution();
  // El user de auth-context solo tiene 'role' (legacy), pero en localStorage
  // puede existir 'roles' como array completo desde el JWT.
  const myRoles: string[] = user?.roles ?? (user?.role ? [user.role] : []);
  const isRoot = myRoles.includes('ROOT');
  const userInstitutionId = user?.institutionId ?? config.id ?? '';
  const myRank = getHighestRoleRank(myRoles);
  const myHighestRole = myRoles.length > 0
    ? myRoles.reduce((best, r) => (ROLE_HIERARCHY[r] ?? -1) > (ROLE_HIERARCHY[best] ?? -1) ? r : best, myRoles[0])
    : null;

  const [institutionFilter, setInstitutionFilter] = useState(userInstitutionId);
  const [includeInactive, setIncludeInactive] = useState(false);

  const params: Record<string, string> = {};
  if (institutionFilter) params.institutionId = institutionFilter;
  if (includeInactive) params.includeInactive = 'true';

  const { data, loading, reload } = useApiList<UserRow>('/users', params);
  const { deleting, del } = useApiDelete('/users');
  const { creating, createError, create, setCreateError } = useApiCreate('/users');
  const { updating, updateError, update, setUpdateError } = useApiUpdate('/users');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '', password: '', name: '', institutionId: '',
    level: '', roles: [] as string[],
  });

  const [institutions, setInstitutions] = useState<Institution[]>([]);

  useEffect(() => {
    apiClient.get('/institutions').then(r => {
      setInstitutions(r.data?.data ?? []);
    }).catch(() => {});
  }, []);

  const resetForm = () => {
    setForm({ email: '', password: '', name: '', institutionId: '', level: '', roles: [] });
    setEditingId(null);
    setShowForm(false);
    setCreateError('');
    setUpdateError('');
  };

  const toggleRole = (role: string) => {
    setForm(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role],
    }));
  };

  const handleCreate = async () => {
    const body: Record<string, unknown> = {
      email: form.email,
      password: form.password,
      name: form.name,
      institutionId: form.institutionId || undefined,
      level: form.level ? parseInt(form.level) : undefined,
      roles: form.roles.length > 0 ? form.roles : undefined,
    };
    const ok = await create(body);
    if (ok) { resetForm(); reload(); }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const body: Record<string, unknown> = {
      email: form.email,
      name: form.name,
      institutionId: form.institutionId || null,
      level: form.level ? parseInt(form.level) : null,
      roles: form.roles,
    };
    const ok = await update(editingId, body);
    if (ok) { resetForm(); reload(); }
  };

  const startEdit = (u: UserRow) => {
    setEditingId(u.id);
    setForm({
      email: u.email,
      password: '',
      name: u.name,
      institutionId: u.institutionId ?? '',
      level: u.level != null ? String(u.level) : '',
      roles: u.roles ?? [],
    });
    setShowForm(true);
  };

  /** ¿Puedo gestionar a este usuario? Basado en jerarquía de ROLES, no nivel educativo. */
  const canManage = (targetRoles: string[]): boolean => {
    return canManageUser(myRoles, targetRoles);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-subtitle">
            Gestión de usuarios del sistema
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block' }}>
              {isRoot
                ? 'Root — acceso total a todos los usuarios'
                : myHighestRole
                  ? `Tu rol: ${roleLabel(myHighestRole)} (jerarquía ${myRank}) — solo podés gestionar usuarios de jerarquía inferior`
                  : 'Sin rol asignado'}
            </span>
          </p>
        </div>
        <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? 'Cancelar' : 'Nuevo usuario'}
        </Button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Institución</label>
          {isRoot ? (
            <select
              value={institutionFilter}
              onChange={e => setInstitutionFilter(e.target.value)}
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
              value={institutions.find(i => i.id === institutionFilter)?.name || config.name || institutionFilter}
              disabled
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            />
          )}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: 'var(--text-sm)', paddingBottom: '0.3rem' }}>
          <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
          Incluir inactivos
        </label>
        <Button variant="ghost" onClick={reload}>Buscar</Button>
      </div>

      {/* Formulario */}
      {showForm && (
        <Card title={editingId ? 'Editar usuario' : 'Nuevo usuario'} className="mt-md">
          {(createError || updateError) && (
            <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
              {createError || updateError}
            </div>
          )}
          <div className="flex flex-col gap-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            </div>
            {!editingId && (
              <Input label="Contraseña" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required placeholder="Mínimo 6 caracteres" />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Institución</label>
                {isRoot ? (
                  <select
                    value={form.institutionId}
                    onChange={e => setForm({ ...form, institutionId: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}
                  >
                    <option value="">Sin institución</option>
                    {institutions.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={institutions.find(i => i.id === form.institutionId)?.name || user?.institutionId || ''}
                    disabled
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)' }}
                  />
                )}
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Nivel educativo</label>
                <select
                  value={form.level}
                  onChange={e => setForm({ ...form, level: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)' }}
                >
                  <option value="">Sin nivel</option>
                  {Object.entries(LEVEL_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Roles — ahora con etiquetas y jerarquía visible */}
            <div>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>
                Roles (jerarquía)
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                {KNOWN_ROLES.map(role => {
                  const rank = ROLE_HIERARCHY[role];
                  return (
                    <label
                      key={role}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        fontSize: 'var(--text-sm)', padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${form.roles.includes(role) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: form.roles.includes(role) ? 'var(--color-primary-soft, #e8f0fe)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} />
                      {roleLabel(role)}
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        ({rank != null ? rank : '?'})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Button variant="success-soft" onClick={editingId ? handleUpdate : handleCreate} loading={creating || updating}>
              {editingId ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </div>
        </Card>
      )}

      {/* Tabla */}
      <Card className="mt-lg">
        <Table
          columns={[
            { key: 'name', header: 'Nombre' },
            { key: 'email', header: 'Email' },
            { key: 'institutionName', header: 'Institución', render: (u: UserRow) => u.institutionName ?? '-' },
            { key: 'level', header: 'Nivel educativo', render: (u: UserRow) => levelLabel(u.level) },
            {
              key: 'roles', header: 'Rol (jerarquía)',
              render: (u: UserRow) => {
                const r = u.roles ?? [];
                return r.length > 0 ? roleHierarchyLabel(r) : 'Sin rol';
              },
            },
            { key: 'active', header: 'Activo', render: (u: UserRow) => u.active ? '✅' : '❌' },
            {
              key: 'actions', header: '',
              render: (u: UserRow) => {
                const manageable = canManage(u.roles ?? []);
                return (
                  <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                    {manageable ? (
                      <>
                        <Button variant="action" size="sm" onClick={() => startEdit(u)}>Editar</Button>
                        <Button variant="danger-soft" size="sm" onClick={() => del(u.id).then(() => reload())} loading={deleting}>Eliminar</Button>
                      </>
                    ) : (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        Jerarquía superior
                      </span>
                    )}
                  </div>
                );
              },
            },
          ]}
          data={data}
          emptyMessage={loading ? 'Cargando...' : 'No hay usuarios'}
        />
      </Card>
    </div>
  );
}
