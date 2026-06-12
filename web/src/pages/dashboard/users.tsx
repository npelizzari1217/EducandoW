import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiDelete, useApiCreate, useApiUpdate } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { LevelCheckboxGroup } from '../../components/ui/level-checkbox-group';
import apiClient from '../../api/client';
import UserPrintView from '../../components/reports/UserPrintView';
import { buildBranding } from '../../components/reports/PremiumPrintReport';
import ModuleAccessGrid from '../../components/users/module-access-grid';
import type { ModuleAccessItem } from '../../components/users/module-access-grid';
import { LEVEL_CATALOG, LEVEL_LABELS as CATALOG_LABELS } from '../../constants/levels';

// ── Tipos ─────────────────────────────────────────────────

interface UserRow {
  [key: string]: unknown;
  id: string;
  email: string;
  name: string;
  institutionId: string | null;
  institutionName: string | null;
  levels?: number[];
  userLevels?: { level: number; modality: number }[];
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

interface ProfileOption {
  id: string;
  name: string;
  _count?: { permissions: number };
}

interface PermissionEntry {
  moduleCode: string;
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPrint: boolean;
}

interface ModuleInfo {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  actions: string[];
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
  const [showPrint, setShowPrint] = useState(false);

  const params: Record<string, string> = {};
  if (institutionFilter) params.institutionId = institutionFilter;
  if (includeInactive) params.includeInactive = 'true';

  const { data, loading, reload } = useApiList<UserRow>('/users', params);
  const { deleting, del } = useApiDelete('/users');
  const { creating, createError, create, setCreateError } = useApiCreate('/users');
  const { updating, updateError, update, setUpdateError } = useApiUpdate('/users');

  // Módulos del sistema
  const { data: moduleList } = useApiList<ModuleInfo>('/modules', {});

  // Estado del grid de acceso a módulos
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessItem[]>([]);

  // Módulos disponibles para asignar:
  // - ROOT: todos los módulos del sistema
  // - no-ROOT: solo los módulos que el creador tiene asignados
  const availableModules = useMemo(() => {
    if (!moduleList || moduleList.length === 0) return [];
    if (isRoot) return moduleList;
    const creatorModules = user?.modules ?? [];
    if (creatorModules.length === 0) return [];
    return moduleList.filter((m) =>
      creatorModules.some((um) => um.moduleCode === m.code),
    );
  }, [moduleList, isRoot, user?.modules]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '', password: '', name: '', institutionId: '',
    selectedLevels: new Set<number>(),
    role: '' as string, active: true,
    profileId: '' as string,
  });

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<ProfileOption[]>([]);

  useEffect(() => {
    apiClient.get('/institutions').then(r => {
      setInstitutions(r.data?.data ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    apiClient.get('/profiles').then(r => {
      setAvailableProfiles(r.data?.data ?? []);
    }).catch(() => {});
  }, []);


  const toggleLevel = (idx: number) => {
    setForm(f => {
      const next = new Set(f.selectedLevels);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return { ...f, selectedLevels: next };
    });
  };

  const resetForm = () => {
    setForm({ email: '', password: '', name: '', institutionId: '', selectedLevels: new Set<number>(), role: '', active: true, profileId: '' });
    setEditingId(null);
    setShowForm(false);
    setCreateError('');
    setUpdateError('');
    setModuleAccess([]);
  };

  const setRole = (role: string) => {
    setForm(prev => ({ ...prev, role }));
  };

  const handleProfileChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value;
    setForm(prev => ({ ...prev, profileId: pid }));
    if (!pid) {
      setModuleAccess([]);
      return;
    }
    try {
      const { data: permData } = await apiClient.get(`/profiles/${pid}/permissions`);
      const perms = permData.data || [];
      // Convert booleans to ModuleAccessItem[]
      const items: ModuleAccessItem[] = perms
        .filter((p: PermissionEntry) => p.canRead || p.canCreate || p.canEdit || p.canDelete || p.canPrint)
        .map((p: PermissionEntry) => ({
          moduleCode: p.moduleCode,
          actions: [
            ...(p.canRead ? ['READ' as const] : []),
            ...(p.canCreate ? ['CREATE' as const] : []),
            ...(p.canEdit ? ['UPDATE' as const] : []),
            ...(p.canDelete ? ['DELETE' as const] : []),
            ...(p.canPrint ? ['PRINT' as const] : []),
          ],
        }));
      setModuleAccess(items);
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    const body: Record<string, unknown> = {
      email: form.email,
      password: form.password,
      name: form.name,
      roles: form.role ? [form.role] : undefined,
      active: form.active,
      moduleAccess: moduleAccess.length > 0 ? moduleAccess : undefined,
      profileId: form.profileId || undefined,
    };
    if (form.selectedLevels.size > 0) {
      body.levels = Array.from(form.selectedLevels).map(i => {
        const opt = LEVEL_CATALOG[i];
        return { level: opt.levelCode, modality: opt.modalityCode };
      });
    }
    if (isRoot) body.institutionId = form.institutionId || undefined;
    const ok = await create(body);
    if (ok) { resetForm(); reload(); }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const body: Record<string, unknown> = {
      email: form.email,
      name: form.name,
      roles: form.role ? [form.role] : undefined,
      active: form.active,
      moduleAccess: moduleAccess.length > 0 ? moduleAccess : undefined,
      profileId: form.profileId || undefined,
    };
    // Always send levels: populated array or empty to clear
    body.levels = Array.from(form.selectedLevels).map(i => {
      const opt = LEVEL_CATALOG[i];
      return { level: opt.levelCode, modality: opt.modalityCode };
    });
    if (isRoot) body.institutionId = form.institutionId || null;
    if (form.password) body.password = form.password;
    const ok = await update(editingId, body);
    if (ok) { resetForm(); reload(); }
  };

  const startEdit = (u: UserRow) => {
    setEditingId(u.id);
    const primaryRole = u.roles && u.roles.length > 0
      ? u.roles.reduce((best, r) => (ROLE_HIERARCHY[r] ?? -1) > (ROLE_HIERARCHY[best] ?? -1) ? r : best, u.roles[0])
      : '';
    // Map userLevels detail back to LEVEL_CATALOG indices for checkbox pre-selection
    const selectedLevels = new Set<number>();
    if (u.userLevels && u.userLevels.length > 0) {
      for (const ul of u.userLevels) {
        const idx = LEVEL_CATALOG.findIndex(
          opt => opt.levelCode === ul.level && opt.modalityCode === ul.modality,
        );
        if (idx !== -1) selectedLevels.add(idx);
      }
    }
    setForm({
      email: u.email,
      password: '',
      name: u.name,
      institutionId: u.institutionId ?? '',
      selectedLevels,
      role: primaryRole,
      active: u.active,
      profileId: '',
    });
    // Pre-cargar módulos del usuario editado si vienen en la respuesta
    const rawModules = (u as Record<string, unknown>).modules;
    if (Array.isArray(rawModules)) {
      setModuleAccess(rawModules as ModuleAccessItem[]);
    } else {
      setModuleAccess([]);
    }
    setShowForm(true);
  };

  /** ¿Puedo gestionar a este usuario? Basado en jerarquía de ROLES, no nivel educativo. */
  const canManage = (targetRoles: string[]): boolean => {
    return canManageUser(myRoles, targetRoles);
  };

  if (showPrint) {
    return (
      <UserPrintView
        branding={buildBranding(config)}
        users={data.map(u => ({
          name: u.name,
          email: u.email,
          institution: u.institutionName ?? (u.institutionId ? `ID: ${u.institutionId}` : '-'),
          role: roleHierarchyLabel(u.roles ?? []),
          level: u.userLevels?.length
            ? u.userLevels.map(ul => CATALOG_LABELS[ul.level * 10 + ul.modality] ?? `Nivel ${ul.level}/${ul.modality}`).join(', ')
            : '-',
          active: u.active,
        }))}
        onClose={() => setShowPrint(false)}
      />
    );
  }

  return (
    <div>
      <PremiumHeader
        title="Usuarios"
        subtitle={`Gestión de usuarios del sistema${isRoot ? ' — Root: acceso total a todos los usuarios' : myHighestRole ? ` — Tu rol: ${roleLabel(myHighestRole)} (jerarquía ${myRank})` : ''}`}
        icon="👥"
        stats={[{ label: 'usuarios', value: String(data.length) }]}
      >
        <button className="mph-btn mph-btn-print no-print" onClick={() => setShowPrint(true)}>🖨 Imprimir</button>
        <button className="mph-btn mph-btn-print no-print" onClick={() => setShowPrint(true)} style={{ background: '#fef2f2', color: '#dc2626' }}>📄 PDF</button>
        <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? 'Cancelar' : 'Nuevo usuario'}
        </Button>
      </PremiumHeader>

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
              value={institutions.find(i => i.id === institutionFilter)?.name || config.name || ''}
              disabled
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', minWidth: '220px' }}
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
            <Input
              label={editingId ? 'Contraseña (opcional)' : 'Contraseña'}
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required={!editingId}
              placeholder={editingId ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-md)' }}>
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
                    value={institutions.find(i => i.id === form.institutionId)?.name || config.name || ''}
                    disabled
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}
                  />
                )}
              </div>
            </div>

            {/* Niveles educativos — componente compartido con Instituciones */}
            <LevelCheckboxGroup selected={form.selectedLevels} onToggle={toggleLevel} />

            {/* Roles — radio buttons, un solo rol por usuario */}
            <div>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>
                Rol (jerarquía)
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                {KNOWN_ROLES.map(role => {
                  const rank = ROLE_HIERARCHY[role];
                  const selected = form.role === role;
                  return (
                    <label
                      key={role}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        fontSize: 'var(--text-sm)', padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: selected ? 'var(--color-primary-soft, rgba(99,102,241,0.15))' : 'transparent',
                        color: 'var(--color-text)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="userRole"
                        value={role}
                        checked={selected}
                        onChange={() => setRole(role)}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      {roleLabel(role)}
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        ({rank != null ? rank : '?'})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Perfil predefinido */}
            <div className="form-group">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Perfil predefinido (opcional)
              </label>
              <select
                value={form.profileId}
                onChange={handleProfileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              >
                <option value="">Sin perfil (manual)</option>
                {availableProfiles.map((p: ProfileOption) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p._count?.permissions ?? 0} módulos)
                  </option>
                ))}
              </select>
            </div>

            {/* Módulos del usuario — grid de checkboxes por módulo y acción */}
            {moduleList.length > 0 && (
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>
                  Módulos del usuario
                  {!isRoot && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: '0.5rem' }}>
                      (solo tus módulos asignados)
                    </span>
                  )}
                </label>
                <ModuleAccessGrid
                  availableModules={availableModules.map(m => ({ code: m.code, name: m.name, actions: m.actions }))}
                  value={moduleAccess}
                  onChange={setModuleAccess}
                />
              </div>
            )}

            {/* Estado activo/inactivo */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: 'var(--text-sm)', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
                style={{ accentColor: 'var(--color-primary)', width: '1rem', height: '1rem' }}
              />
              <span style={{ fontWeight: 500 }}>Activo</span>
            </label>

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <Button variant="success-soft" onClick={editingId ? handleUpdate : handleCreate} loading={creating || updating}>
                {editingId ? 'Guardar cambios' : 'Crear usuario'}
              </Button>
              <Button variant="danger-soft" onClick={resetForm}>Cancelar</Button>
            </div>
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
            {
              key: 'levels', header: 'Niveles educativos',
              render: (u: UserRow) => {
                const detail = u.userLevels ?? [];
                if (detail.length > 0) {
                  return (
                    <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                      {detail.map(ul => {
                        const code = ul.level * 10 + ul.modality;
                        const label = CATALOG_LABELS[code] ?? `Nivel ${ul.level}/${ul.modality}`;
                        return (
                          <span key={code} style={{
                            display: 'inline-block', padding: '1px 6px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--color-primary-soft, rgba(99,102,241,0.12))',
                            color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 500,
                          }}>{label}</span>
                        );
                      })}
                    </div>
                  );
                }
                return '-';
              },
            },
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
