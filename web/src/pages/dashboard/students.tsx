import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiDelete, useApiCreate, extractErrorMessage } from '../../hooks/use-api';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import apiClient from '../../api/client';

interface Institution { id: string; name: string; }

const ALLOWED_FIELDS = ['phone', 'address', 'photoUrl', 'email', 'birthDate', 'guardianPhone'];

export default function StudentsPage() {
  const { user } = useAuth();
  const { config } = useInstitution();
  const roles: string[] = user?.roles ?? [];
  const isRoot = roles.includes('ROOT');
  const isTutor = roles.includes('TUTOR');
  const isStudent = roles.includes('STUDENT');
  const isAdmin = roles.includes('ADMIN') || roles.includes('MANAGER');
  const isStaff = isRoot || isAdmin || roles.includes('MANAGER') || roles.includes('TEACHER') || roles.includes('PRECEPTOR');

  const userInstitutionId = user?.institutionId ?? config.id ?? '';

  const [institutionId, setInstitutionId] = useState(userInstitutionId);
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  useEffect(() => {
    apiClient.get('/institutions').then(r => {
      setInstitutions(r.data?.data ?? []);
    }).catch(() => {});
  }, []);

  // ── TUTOR mode: my-children ───────────────────────────────

  const { data: tutorData, loading: tutorLoading } = useApiList<{ id: string; firstName: string; lastName: string; dni: string; fullName: string; email?: string; birthDate?: string; guardianName?: string; guardianPhone?: string; address?: string; phone?: string; photoUrl?: string }>(
    '/students/my-children',
    isTutor ? {} : undefined,
  );

  // ── STUDENT mode: own profile ────────────────────────────

  const [studentProfile, setStudentProfile] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState<Record<string, string>>({});
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (!isStudent || (!isTutor && !isStudent && !isStaff)) return;
    if (!isStudent) return;
    setProfileLoading(true);
    apiClient.get('/students/me')
      .then(r => {
        const s = r.data?.data;
        setStudentProfile(s);
        if (s) {
          const form: Record<string, string> = {};
          for (const field of ALLOWED_FIELDS) {
            const val = s[field];
            form[field] = val !== undefined && val !== null ? String(val) : '';
          }
          setProfileForm(form);
        }
      })
      .catch(() => setProfileError('Error al cargar perfil'))
      .finally(() => setProfileLoading(false));
  }, [isStudent]);

  const handleProfileSave = async () => {
    if (!studentProfile) return;
    setProfileSaving(true);
    setProfileError('');

    // Build patch body: only include fields that changed from original
    const body: Record<string, string | null> = {};
    for (const field of ALLOWED_FIELDS) {
      const original = studentProfile[field];
      const newVal = profileForm[field];
      const originalStr = original !== undefined && original !== null ? String(original) : '';
      if (newVal !== originalStr) {
        body[field] = newVal || null;
      }
    }

    try {
      const r = await apiClient.patch(`/students/${studentProfile.id}`, body);
      setStudentProfile(r.data?.data);
      setProfileError('Guardado correctamente');
    } catch (e: unknown) {
      setProfileError(extractErrorMessage(e) || 'Error al guardar');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── ADMIN/STAFF mode: list students ───────────────────────

  const { data: adminData, loading: adminLoading, reload: adminReload } = useApiList<{ id: string; firstName: string; lastName: string; dni: string; fullName: string }>(
    '/students',
    isStaff && !isTutor && !isStudent ? { institutionId } : undefined,
  );
  const { deleting, del } = useApiDelete('/students');
  const { creating, createError, create } = useApiCreate('/students');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', dni: '', email: '', birthDate: '', guardianName: '', guardianPhone: '', institutionId: institutionId });

  const handleCreate = async () => {
    const ok = await create({ ...form, birthDate: form.birthDate || undefined, guardianName: form.guardianName || undefined, guardianPhone: form.guardianPhone || undefined, email: form.email || undefined, institutionId: institutionId });
    if (ok) { setShowForm(false); adminReload(); }
  };

  // ── Render: STUDENT mode ──────────────────────────────────

  if (isStudent) {
    return (
      <div>
        <div className="page-header">
          <div><h1 className="page-title">Mis Datos</h1><p className="page-subtitle">Tu ficha personal</p></div>
        </div>

        {profileLoading && <p>Cargando...</p>}

        {profileError && (
          <div style={{ background: profileError.includes('correctamente') ? '#f0fdf4' : '#fef2f2', color: profileError.includes('correctamente') ? 'var(--color-success)' : 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
            {profileError}
          </div>
        )}

        {studentProfile && (
          <Card className="mt-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Nombre</label>
                <input type="text" value={(studentProfile?.firstName as string) ?? ''} disabled
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Apellido</label>
                <input type="text" value={(studentProfile?.lastName as string) ?? ''} disabled
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', width: '100%' }} />
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-md)' }}>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>DNI</label>
              <input type="text" value={(studentProfile?.dni as string) ?? ''} disabled
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', width: '100%' }} />
            </div>

            {ALLOWED_FIELDS.map(field => (
              <div key={field} style={{ marginTop: 'var(--space-md)' }}>
                <Input
                  label={field === 'photoUrl' ? 'URL de foto' : field === 'birthDate' ? 'Fecha de nacimiento' : field === 'guardianPhone' ? 'Teléfono del tutor' : field.charAt(0).toUpperCase() + field.slice(1)}
                  type={field === 'birthDate' ? 'date' : 'text'}
                  value={profileForm[field] ?? ''}
                  onChange={e => setProfileForm({ ...profileForm, [field]: e.target.value })}
                />
              </div>
            ))}

            <div style={{ marginTop: 'var(--space-md)' }}>
              <Button variant="success-soft" onClick={handleProfileSave} loading={profileSaving}>Guardar cambios</Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── Render: TUTOR mode ────────────────────────────────────

  if (isTutor) {
    return (
      <div>
        <div className="page-header">
          <div><h1 className="page-title">Mis Hijos</h1><p className="page-subtitle">Datos de tus hijos</p></div>
        </div>

        <Card className="mt-lg">
          <Table
            columns={[
              { key: 'fullName', header: 'Nombre' },
              { key: 'dni', header: 'DNI' },
              { key: 'email', header: 'Email', render: (s: Record<string, unknown>) => (s.email as string) ?? '-' },
              { key: 'phone', header: 'Teléfono', render: (s: Record<string, unknown>) => (s.phone as string) ?? '-' },
            ]}
            data={tutorData}
            emptyMessage={tutorLoading ? 'Cargando...' : 'No hay hijos vinculados a tu cuenta'}
          />
        </Card>
      </div>
    );
  }

  // ── Render: ADMIN/STAFF mode (default) ────────────────────

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Estudiantes</h1><p className="page-subtitle">Gestión de alumnos</p></div>
        <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nuevo estudiante'}</Button>
      </div>

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
        <Button variant="ghost" onClick={adminReload} style={{ marginTop: '1.25rem' }}>Buscar</Button>
      </div>

      {showForm && (
        <Card title="Nuevo estudiante" className="mt-md">
          {createError && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{createError}</div>}
          <div className="flex flex-col gap-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input label="Nombre" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required />
              <Input label="Apellido" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required />
            </div>
            <Input label="DNI" value={form.dni} onChange={e => setForm({...form, dni: e.target.value})} required />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <Input label="Fecha de nacimiento" type="date" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} />
            <Input label="Nombre del tutor" value={form.guardianName} onChange={e => setForm({...form, guardianName: e.target.value})} />
            <Input label="Teléfono del tutor" value={form.guardianPhone} onChange={e => setForm({...form, guardianPhone: e.target.value})} />
            <Button variant="success-soft" onClick={handleCreate} loading={creating}>Crear estudiante</Button>
          </div>
        </Card>
      )}

      <Card className="mt-lg">
        <Table
          columns={[{ key: 'fullName', header: 'Nombre' }, { key: 'dni', header: 'DNI' }, { key: 'actions', header: '', render: (s) => <Button variant="danger-soft" size="sm" onClick={() => del(s.id).then(() => adminReload())} loading={deleting}>Eliminar</Button> }]}
          data={adminData}
          emptyMessage={adminLoading ? 'Cargando...' : 'No hay estudiantes'}
        />
      </Card>
    </div>
  );
}
