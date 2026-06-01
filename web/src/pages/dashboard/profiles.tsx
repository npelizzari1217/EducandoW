import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import { useApiList, useApiDelete, useApiCreate, useApiUpdate, extractErrorMessage } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import apiClient from '../../api/client';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import ModuleAccessGrid from '../../components/users/module-access-grid';
import type { ModuleAccessItem, ModuleInfo as GridModuleInfo } from '../../components/users/module-access-grid';

// ── Tipos ─────────────────────────────────────────────────

interface Profile {
  id: string;
  name: string;
  institutionId: string | null;
  _count?: { permissions: number };
  createdAt: string;
  updatedAt: string;
}

interface PermissionRow {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
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

// ── Conversión de funciones ───────────────────────────────

export function booleansToModuleAccess(permissions: PermissionRow[]): ModuleAccessItem[] {
  return permissions
    .filter((p) => p.canRead || p.canCreate || p.canEdit || p.canDelete || p.canPrint)
    .map((p) => ({
      moduleCode: p.moduleCode,
      actions: [
        ...(p.canRead ? ['READ'] : []),
        ...(p.canCreate ? ['CREATE'] : []),
        ...(p.canEdit ? ['UPDATE'] : []),
        ...(p.canDelete ? ['DELETE'] : []),
        ...(p.canPrint ? ['PRINT'] : []),
      ],
    }));
}

export function moduleAccessToBooleans(items: ModuleAccessItem[], modules: ModuleInfo[]): any[] {
  const codeToId: Record<string, string> = {};
  for (const m of modules) {
    codeToId[m.code] = m.id;
  }
  return items
    .filter((item) => codeToId[item.moduleCode])
    .map((item) => ({
      moduleId: codeToId[item.moduleCode],
      canRead: item.actions.includes('READ'),
      canCreate: item.actions.includes('CREATE'),
      canEdit: item.actions.includes('UPDATE'),
      canDelete: item.actions.includes('DELETE'),
      canPrint: item.actions.includes('PRINT'),
    }));
}

// ── Componente ────────────────────────────────────────────

export default function ProfilesPage() {
  const { user } = useAuth();

  const { data: profiles, loading, reload } = useApiList<Profile>('/profiles');
  const { del } = useApiDelete('/profiles');
  const { createError, setCreateError } = useApiCreate('/profiles');
  const { updateError, setUpdateError } = useApiUpdate('/profiles');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [formName, setFormName] = useState('');
  const [formPermissions, setFormPermissions] = useState<ModuleAccessItem[]>([]);
  const [allModules, setAllModules] = useState<ModuleInfo[]>([]);

  const isRoot = user?.roles?.includes('ROOT') ?? false;
  const userModules = user?.modules ?? [];
  const hasModuleAction = (moduleCode: string, ...actions: string[]) =>
    isRoot || userModules.some((m) => m.moduleCode === moduleCode && actions.some((a) => m.actions.includes(a)));

  // Fetch modules on mount
  useEffect(() => {
    apiClient.get('/modules').then((r) => {
      setAllModules(r.data?.data ?? []);
    }).catch(() => {});
  }, []);

  // Convert allModules to ModuleInfo[] for the grid
  const moduleInfoList = useMemo(() => allModules.map((m) => ({
    code: m.code,
    name: m.name,
    actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'],
  })), [allModules]);

  const handleNew = useCallback(() => {
    setFormName('');
    setFormPermissions([]);
    setEditingId(null);
    setSaveError('');
    setCreateError('');
    setUpdateError('');
    setShowForm(true);
  }, [setCreateError, setUpdateError]);

  const clearForm = useCallback(() => {
    setShowForm(false);
    setFormName('');
    setFormPermissions([]);
    setEditingId(null);
    setSaveError('');
    setCreateError('');
    setUpdateError('');
  }, [setCreateError, setUpdateError]);

  const handleEdit = useCallback(async (id: string) => {
    setEditingId(id);
    setSaveError('');
    setUpdateError('');
    try {
      const { data: res } = await apiClient.get(`/profiles/${id}`);
      const profile = res.data;
      if (profile) {
        setFormName(profile.name ?? '');
      }

      const { data: permRes } = await apiClient.get(`/profiles/${id}/permissions`);
      const perms = (permRes.data || []) as PermissionRow[];
      setFormPermissions(booleansToModuleAccess(perms));
      setShowForm(true);
    } catch (e: unknown) {
      setSaveError(extractErrorMessage(e) || 'Error al cargar perfil');
    }
  }, [setUpdateError]);

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      setSaveError('El nombre es obligatorio');
      return;
    }

    if (allModules.length === 0) {
      setSaveError('Cargando módulos del sistema...');
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      if (editingId) {
        // Update name
        await apiClient.patch(`/profiles/${editingId}`, { name: formName.trim() });
        // Update permissions
        await apiClient.put(`/profiles/${editingId}/permissions`, {
          permissions: moduleAccessToBooleans(formPermissions, allModules),
        });
      } else {
        // Create
        const { data: created } = await apiClient.post('/profiles', { name: formName.trim() });
        const newId = created.data?.id || created.id;
        if (newId) {
          await apiClient.put(`/profiles/${newId}/permissions`, {
            permissions: moduleAccessToBooleans(formPermissions, allModules),
          });
        }
      }
      clearForm();
      reload();
    } catch (e: unknown) {
      setSaveError(extractErrorMessage(e) || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }, [formName, editingId, formPermissions, allModules, clearForm, reload]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('¿Eliminar este perfil?')) return;
    const success = await del(id);
    if (success) {
      reload();
    }
  }, [del, reload]);

  const errorMessage = createError || updateError || saveError;

  const columns = useMemo(() => [
    { key: 'name', header: 'Nombre' },
    { key: 'moduleCount', header: 'Módulos', render: (p: any) => p._count?.permissions ?? 0 },
    {
      key: 'actions',
      header: '',
      render: (p: any) => {
        const canEdit = hasModuleAction('USERS', 'READ', 'UPDATE');
        const canDelete = hasModuleAction('USERS', 'DELETE');
        if (!canEdit) return null;
        return (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <Button variant="action" size="sm" onClick={() => handleEdit(p.id)}>Editar</Button>
            {canDelete && (
              <Button variant="danger-soft" size="sm" onClick={() => handleDelete(p.id)}>Eliminar</Button>
            )}
          </div>
        );
      },
    },
  ], [handleEdit, handleDelete, hasModuleAction]);

  return (
    <div>
      <PremiumHeader
        title="Perfiles de Usuario"
        subtitle="Plantillas de permisos pre-configuradas para asignar a usuarios"
        icon="👥"
      >
        <Button
          variant={showForm ? 'danger-soft' : 'success-soft'}
          onClick={() => showForm ? clearForm() : handleNew()}
        >
          {showForm ? 'Cancelar' : 'Nuevo Perfil'}
        </Button>
      </PremiumHeader>

      {showForm && (
        <Card title={editingId ? 'Editar perfil' : 'Nuevo perfil'} className="mt-md">
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

          <div className="flex flex-col gap-md">
            <Input
              label="Nombre del perfil *"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />

            {allModules.length > 0 && (
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>
                  Permisos del perfil
                </label>
                <ModuleAccessGrid
                  availableModules={moduleInfoList as GridModuleInfo[]}
                  value={formPermissions}
                  onChange={setFormPermissions}
                />
              </div>
            )}

            <Button variant="success-soft" onClick={handleSave} loading={saving}>
              {editingId ? 'Guardar cambios' : 'Crear perfil'}
            </Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={columns}
          data={profiles as unknown as Record<string, unknown>[]}
          emptyMessage={loading ? 'Cargando...' : 'No hay perfiles'}
        />
      </Card>
    </div>
  );
}
