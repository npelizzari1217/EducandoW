import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiDelete, useApiCreate, useApiUpdate, extractErrorMessage } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Modal } from '../../components/ui/modal';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import apiClient from '../../api/client';
import StudentPrintView from '../../components/reports/StudentPrintView';
import { buildBranding } from '../../components/reports/PremiumPrintReport';
import { downloadBoletin } from '../../hooks/useBoletin';
import { AceptadosPanel } from './components/AceptadosPanel';

interface Institution { id: string; name: string; }

const ALLOWED_FIELDS = ['phone', 'address', 'photoUrl', 'email', 'birthDate', 'guardianPhone'];

export default function StudentsPage() {
  const { user } = useAuth();
  const { config } = useInstitution();
  const roles: string[] = user?.roles ?? [];
  const isRoot = roles.includes('ROOT');
  const isTutor = roles.includes('TUTOR');
  const isStudent = roles.includes('STUDENT');
  const isAdmin = roles.includes('ADMIN');
  const isStaff = isRoot || isAdmin || roles.includes('DIRECTOR') || roles.includes('SECRETARIO') || roles.includes('TEACHER') || roles.includes('PRECEPTOR');

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
  const { updating, updateError, update } = useApiUpdate('/students', institutionId ? { institutionId } : undefined);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', dni: '', email: '', birthDate: '', guardianName: '', guardianPhone: '', motherName: '', fatherDni: '', fatherEmail: '', motherDni: '', motherEmail: '', institutionId: institutionId });
  const [formError, setFormError] = useState('');
  const [showPrint, setShowPrint] = useState(false);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);
  const [guardians, setGuardians] = useState<{
    id: string;
    userId?: string | null;
    fullName?: string;
    mobile?: string;
    email?: string;
    relationship: string;
    isFinancialResponsible: boolean;
    isAuthorizedToPickUp: boolean;
    active: boolean;
  }[]>([]);
  const [guardiansLoading, setGuardiansLoading] = useState(false);
  const [guardianError, setGuardianError] = useState('');
  const [showAssignGuardian, setShowAssignGuardian] = useState(false);
  const [guardianAssignForm, setGuardianAssignForm] = useState({ userId: '', fullName: '', mobile: '', email: '', relationship: '', isFinancialResponsible: false, isAuthorizedToPickUp: false, active: true });
  const [assigningGuardian, setAssigningGuardian] = useState(false);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [updatingGuardian, setUpdatingGuardian] = useState(false);
  // Bug 4 fix: track when a 409 TUTOR_DUPLICATE_NAME was received so the UI can offer override
  const [duplicateNamePending, setDuplicateNamePending] = useState(false);
  const [detailStudent, setDetailStudent] = useState<{ fatherEmail?: string; motherEmail?: string } | null>(null);
  const [removeGuardianId, setRemoveGuardianId] = useState<string | null>(null);
  const [removingGuardian, setRemovingGuardian] = useState(false);
  const [boletinStudentId, setBoletinStudentId] = useState<string | null>(null);
  // SDD-2 R16: membership items replace enrollment rows; id = AlumnosXCursoXCiclo bridge-row id.
  const [boletinMemberships, setBoletinMemberships] = useState<{ id: string; level: number; academicYear: string; grade: string | null; division: string | null; printable: boolean }[]>([]);
  const [boletinLoading, setBoletinLoading] = useState(false);

  const handleBoletinClick = async (studentId: string) => {
    setBoletinStudentId(studentId);
    setBoletinLoading(true);
    try {
      // SDD-2 R16: GET /students/:studentId/memberships instead of GET /enrollments
      const res = await apiClient.get(`/students/${studentId}/memberships`);
      const memberships = (res.data?.data ?? []).filter((m: { printable: boolean }) => m.printable);
      setBoletinMemberships(memberships);
      if (memberships.length === 1) {
        await downloadBoletin(memberships[0].id);
        setBoletinStudentId(null);
        setBoletinMemberships([]);
      }
    } catch {
      setBoletinStudentId(null);
      setBoletinMemberships([]);
    } finally {
      setBoletinLoading(false);
    }
  };

  const loadGuardians = async (studentId: string) => {
    setGuardiansLoading(true); setGuardianError('');
    try {
      const r = await apiClient.get(`/students/${studentId}/guardians`);
      setGuardians(r.data?.data ?? []);
    } catch { setGuardianError('Error al cargar tutores'); }
    finally { setGuardiansLoading(false); }
  };

  const loadStudentDetail = (studentId: string) => {
    apiClient.get(`/students/${studentId}`)
      .then(r => {
        const s = r.data?.data;
        if (s) setDetailStudent({ fatherEmail: s.fatherEmail ?? undefined, motherEmail: s.motherEmail ?? undefined });
      })
      .catch(() => { /* non-critical — email pre-fill won't work */ });
  };

  const handleSelectDetail = (studentId: string) => {
    setDetailStudentId(studentId);
    setDetailStudent(null);
    loadGuardians(studentId);
    loadStudentDetail(studentId);
  };

  const resetGuardianForm = () => {
    setGuardianAssignForm({ userId: '', fullName: '', mobile: '', email: '', relationship: '', isFinancialResponsible: false, isAuthorizedToPickUp: false, active: true });
    setEditingGuardianId(null);
    setShowAssignGuardian(false);
    setGuardianError('');
    setDuplicateNamePending(false);
  };

  const startEditGuardian = (g: { id: string; userId?: string | null; fullName?: string; mobile?: string; email?: string; relationship: string; isFinancialResponsible: boolean; isAuthorizedToPickUp: boolean; active: boolean }) => {
    setEditingGuardianId(g.id);
    setGuardianAssignForm({
      userId: g.userId ?? '',
      fullName: g.fullName ?? '',
      mobile: g.mobile ?? '',
      email: g.email ?? '',
      relationship: g.relationship,
      isFinancialResponsible: g.isFinancialResponsible,
      isAuthorizedToPickUp: g.isAuthorizedToPickUp,
      active: g.active,
    });
    setShowAssignGuardian(true);
  };

  const handleGuardianRelationshipChange = (newRelationship: string) => {
    const lower = newRelationship.toLowerCase().trim();
    let emailValue = guardianAssignForm.email;
    // Only pre-fill if email is currently empty (never overwrite user-typed content)
    if (!emailValue) {
      if (['father', 'padre', 'papá', 'papa'].includes(lower) && detailStudent?.fatherEmail) {
        emailValue = detailStudent.fatherEmail;
      } else if (['mother', 'madre', 'mamá', 'mama'].includes(lower) && detailStudent?.motherEmail) {
        emailValue = detailStudent.motherEmail;
      }
    }
    setGuardianAssignForm({ ...guardianAssignForm, relationship: newRelationship, email: emailValue });
  };

  // Bug 4 fix: overrideAllowDuplicate=true re-sends the form with allowDuplicate:true
  // after the user clicks "Confirmar de todas formas" following a 409 TUTOR_DUPLICATE_NAME.
  const handleSaveGuardian = async (overrideAllowDuplicate = false) => {
    if (!detailStudentId) return;
    // Bug 7 fix: fullName/mobile required only for study-tutor path (no userId).
    // Portal-link path (userId present) needs only userId + relationship.
    if (!guardianAssignForm.userId.trim()) {
      if (!guardianAssignForm.fullName.trim()) { setGuardianError('El nombre completo es requerido'); return; }
      if (!guardianAssignForm.mobile.trim()) { setGuardianError('El móvil es requerido'); return; }
    }
    if (!guardianAssignForm.relationship.trim()) { setGuardianError('El parentesco es requerido'); return; }

    if (editingGuardianId) {
      // PATCH existing guardian
      setUpdatingGuardian(true); setGuardianError('');
      try {
        const body: Record<string, unknown> = {
          fullName: guardianAssignForm.fullName || undefined,
          mobile: guardianAssignForm.mobile || undefined,
          // Bug 3 fix: empty email in EDIT mode sends null (explicit clear) not undefined (leave unchanged)
          email: guardianAssignForm.email || null,
          relationship: guardianAssignForm.relationship || undefined,
          active: guardianAssignForm.active,
          isFinancialResponsible: guardianAssignForm.isFinancialResponsible,
          isAuthorizedToPickUp: guardianAssignForm.isAuthorizedToPickUp,
        };
        await apiClient.patch(`/students/${detailStudentId}/guardians/${editingGuardianId}`, body);
        resetGuardianForm();
        loadGuardians(detailStudentId);
      } catch (e: unknown) { setGuardianError(extractErrorMessage(e) || 'Error al actualizar tutor'); }
      finally { setUpdatingGuardian(false); }
    } else {
      // POST new guardian — study tutor (no userId) or portal link (userId provided)
      setAssigningGuardian(true); setGuardianError('');
      setDuplicateNamePending(false);
      try {
        const body: Record<string, unknown> = {
          // Bug 7 fix: omit fullName/mobile when empty so Zod's min(1) doesn't reject portal-link.
          // Study-tutor path always has non-empty values (validated above); portal-link may skip them.
          fullName: guardianAssignForm.fullName || undefined,
          mobile: guardianAssignForm.mobile || undefined,
          email: guardianAssignForm.email || undefined,
          relationship: guardianAssignForm.relationship,
          isFinancialResponsible: guardianAssignForm.isFinancialResponsible,
          isAuthorizedToPickUp: guardianAssignForm.isAuthorizedToPickUp,
          active: guardianAssignForm.active,
        };
        // Only include userId if provided (portal-link path)
        if (guardianAssignForm.userId.trim()) body.userId = guardianAssignForm.userId.trim();
        // Bug 4 fix: include allowDuplicate:true when admin confirmed the duplicate override
        if (overrideAllowDuplicate) body.allowDuplicate = true;
        await apiClient.post(`/students/${detailStudentId}/guardians`, body);
        // axios treats all 2xx (incl. 201) as success — no explicit status check needed
        resetGuardianForm();
        loadGuardians(detailStudentId);
      } catch (e: unknown) {
        const msg = extractErrorMessage(e);
        // Bug 4 fix: on TUTOR_DUPLICATE_NAME show a confirm override instead of a generic error
        if (msg === 'TUTOR_DUPLICATE_NAME') {
          setDuplicateNamePending(true);
          setGuardianError('Ya existe un tutor activo con ese nombre. Hacé clic en "Confirmar de todas formas" para crear uno diferente.');
        } else {
          setGuardianError(msg || 'Error al asignar tutor');
        }
      }
      finally { setAssigningGuardian(false); }
    }
  };

  const handleRemoveGuardian = async () => {
    if (!removeGuardianId) return;
    setRemovingGuardian(true);
    try {
      await apiClient.delete(`/students/${detailStudentId}/guardians/${removeGuardianId}`);
      setRemoveGuardianId(null);
      if (detailStudentId) loadGuardians(detailStudentId);
    } catch (e: unknown) { setGuardianError(extractErrorMessage(e)); }
    finally { setRemovingGuardian(false); }
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.firstName.trim()) { setFormError('El nombre es requerido'); return; }
    if (!form.lastName.trim()) { setFormError('El apellido es requerido'); return; }
    if (!form.dni.trim()) { setFormError('El DNI es requerido'); return; }
    // Bug 6 fix: send fatherEmail/motherEmail as raw strings ('' clears, undefined = absent).
    // PatchStudentUseCase treats '' as clear and missing key as "leave unchanged".
    const body = { ...form, birthDate: form.birthDate || undefined, guardianName: form.guardianName || undefined, guardianPhone: form.guardianPhone || undefined, motherName: form.motherName || undefined, fatherDni: form.fatherDni || undefined, fatherEmail: form.fatherEmail, motherDni: form.motherDni || undefined, motherEmail: form.motherEmail, email: form.email || undefined, institutionId: institutionId };
    if (editingId) {
      const ok = await update(editingId, body);
      if (ok) { resetForm(); adminReload(); }
    } else {
      const ok = await create(body);
      if (ok) { resetForm(); adminReload(); }
    }
  };

  const startEdit = (s: { id: string; firstName: string; lastName: string; dni: string; email?: string; birthDate?: string; guardianName?: string; guardianPhone?: string; motherName?: string; fatherDni?: string; fatherEmail?: string | null; motherDni?: string; motherEmail?: string | null }) => {
    setEditingId(s.id);
    setForm({
      firstName: s.firstName, lastName: s.lastName, dni: s.dni,
      email: s.email ?? '', birthDate: s.birthDate ?? '',
      guardianName: s.guardianName ?? '', guardianPhone: s.guardianPhone ?? '',
      motherName: s.motherName ?? '', fatherDni: s.fatherDni ?? '', fatherEmail: s.fatherEmail ?? '',
      motherDni: s.motherDni ?? '', motherEmail: s.motherEmail ?? '',
      institutionId: institutionId,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({ firstName: '', lastName: '', dni: '', email: '', birthDate: '', guardianName: '', guardianPhone: '', motherName: '', fatherDni: '', fatherEmail: '', motherDni: '', motherEmail: '', institutionId: institutionId });
    setEditingId(null);
    setShowForm(false);
    setFormError('');
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

  if (showPrint) {
    return (
      <StudentPrintView
        branding={buildBranding(config)}
          students={adminData.map(s => ({
            firstName: s.firstName,
            lastName: s.lastName,
            dni: s.dni,
            grade: '-',
            division: '-',
            status: 'ACTIVE',
            enrollmentYear: String(new Date().getFullYear()),
            guardianName: (s as Record<string, unknown>).guardianName as string ?? '-',
            guardianPhone: (s as Record<string, unknown>).guardianPhone as string ?? '-',
          }))}
        onClose={() => setShowPrint(false)}
      />
    );
  }

  return (
    <div>
      <PremiumHeader
        title="Estudiantes"
        subtitle="Gestión de alumnos"
        icon="🎓"
        stats={[{ label: 'estudiantes', value: String(adminData.length) }]}
      >
        <button className="mph-btn mph-btn-print no-print" onClick={() => setShowPrint(true)}>🖨 Imprimir</button>
        <button className="mph-btn mph-btn-print no-print" onClick={() => setShowPrint(true)} style={{ background: '#fef2f2', color: '#dc2626' }}>📄 PDF</button>
        <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => { resetForm(); setShowForm(!showForm); }}>{showForm ? 'Cancelar' : 'Nuevo estudiante'}</Button>
      </PremiumHeader>

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

      <Modal
        open={showForm}
        title={editingId ? 'Editar estudiante' : 'Nuevo estudiante'}
        onClose={resetForm}
      >
          {(formError || createError) && <div style={{ background: '#fef2f2', color: 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{formError || createError || updateError}</div>}
          <div className="flex flex-col gap-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <Input label="Nombre" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value.toUpperCase()})} required />
              <Input label="Apellido" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value.toUpperCase()})} required />
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Institución</label>
              {isRoot ? (
                <select
                  value={form.institutionId || institutionId}
                  onChange={e => setForm({...form, institutionId: e.target.value})}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', width: '100%' }}
                >
                  <option value="">Seleccionar institución</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={institutions.find(i => i.id === institutionId)?.name || config.name || institutionId}
                  disabled
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', width: '100%' }}
                />
              )}
            </div>
            <Input label="DNI" value={form.dni} onChange={e => setForm({...form, dni: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})} required disabled={!!editingId} />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <Input label="Fecha de nacimiento" type="date" value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} />
            <Input label="Nombre completo del Padre" value={form.guardianName} onChange={e => setForm({...form, guardianName: e.target.value})} />
            <Input label="Teléfono del Padre" value={form.guardianPhone} onChange={e => setForm({...form, guardianPhone: e.target.value})} />
            <Input label="DNI del Padre" value={form.fatherDni} onChange={e => setForm({...form, fatherDni: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})} />
            <Input label="Email del Padre" type="email" value={form.fatherEmail} onChange={e => setForm({...form, fatherEmail: e.target.value})} />
            <Input label="Nombre completo de la Madre" value={form.motherName} onChange={e => setForm({...form, motherName: e.target.value})} />
            <Input label="DNI de la Madre" value={form.motherDni} onChange={e => setForm({...form, motherDni: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})} />
            <Input label="Email de la Madre" type="email" value={form.motherEmail} onChange={e => setForm({...form, motherEmail: e.target.value})} />
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <Button variant="success-soft" onClick={handleSave} loading={creating || updating}>{editingId ? 'Guardar cambios' : 'Crear estudiante'}</Button>
              <Button variant="danger-soft" onClick={resetForm}>Cancelar</Button>
            </div>
          </div>
      </Modal>

      <Card className="mt-lg">
        <Table
          columns={[{ key: 'fullName', header: 'Nombre' }, { key: 'dni', header: 'DNI' }, { key: 'actions', header: '', render: (s) => {
            const sid = s.id as string;
            const isBoletinDropdown = boletinStudentId === sid && boletinMemberships.length > 1;
            return (
              <div>
                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                  <Button variant="action" size="sm" onClick={() => startEdit(s as { id: string; firstName: string; lastName: string; dni: string })}>Editar</Button>
                  <Button variant="action" size="sm" onClick={() => handleSelectDetail(sid)} style={{ background: 'var(--color-secondary-soft-bg, #e8f4fd)', color: 'var(--color-secondary-soft-text, #1d4ed8)' }}>Tutores</Button>
                  <Button
                    variant="action"
                    size="sm"
                    onClick={() => handleBoletinClick(sid)}
                    loading={boletinLoading && boletinStudentId === sid}
                    disabled={boletinLoading && boletinStudentId !== sid}
                    title="Descargar boletín en PDF"
                  >
                    📄 Boletín
                  </Button>
                  <Button variant="danger-soft" size="sm" onClick={() => del(sid).then(() => adminReload())} loading={deleting}>Eliminar</Button>
                </div>
                {isBoletinDropdown && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) downloadBoletin(e.target.value);
                      setBoletinStudentId(null);
                      setBoletinMemberships([]);
                    }}
                    style={{ marginTop: 'var(--space-xs)', padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-xs)', width: '100%' }}
                  >
                    <option value="">Elegir curso ciclo...</option>
                    {boletinMemberships.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.level} {m.academicYear} — {m.grade || 'S/G'} {m.division || ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          } }]}
          data={adminData}
          emptyMessage={adminLoading ? 'Cargando...' : 'No hay estudiantes'}
        />
      </Card>

      {/* ── Guardian Management ─────────────────────────── */}
      {detailStudentId && (
        <Card title={`Tutores — Alumno ${detailStudentId}`} className="mt-lg">
          {guardianError && <div style={{ background: guardianError.includes('correctamente') ? '#f0fdf4' : '#fef2f2', color: guardianError.includes('correctamente') ? 'var(--color-success)' : 'var(--color-danger)', padding: '0.5rem', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>{guardianError}</div>}

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <Button variant="success-soft" onClick={() => { if (showAssignGuardian) { resetGuardianForm(); } else { setShowAssignGuardian(true); setGuardianError(''); } }}>
              {showAssignGuardian ? 'Cancelar' : 'Agregar tutor'}
            </Button>
          </div>

          {showAssignGuardian && (
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <Card title={editingGuardianId ? 'Editar tutor' : 'Agregar tutor'}>
                <div className="flex flex-col gap-md">
                  <Input label="Nombre completo" name="guardian-fullName" value={guardianAssignForm.fullName} onChange={e => setGuardianAssignForm({...guardianAssignForm, fullName: e.target.value})} required />
                  <Input label="Móvil" name="guardian-mobile" value={guardianAssignForm.mobile} onChange={e => setGuardianAssignForm({...guardianAssignForm, mobile: e.target.value})} required />
                  <Input label="Parentesco" name="guardian-relationship" value={guardianAssignForm.relationship} onChange={e => handleGuardianRelationshipChange(e.target.value)} maxLength={15} required />
                  <Input label="Email del tutor" type="email" name="guardian-email" value={guardianAssignForm.email} onChange={e => setGuardianAssignForm({...guardianAssignForm, email: e.target.value})} />
                  <Input label="ID de cuenta (opcional)" name="guardian-userId" value={guardianAssignForm.userId} onChange={e => setGuardianAssignForm({...guardianAssignForm, userId: e.target.value})} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}>
                    <input type="checkbox" checked={guardianAssignForm.active} onChange={e => setGuardianAssignForm({...guardianAssignForm, active: e.target.checked})} />
                    Activo
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}>
                    <input type="checkbox" checked={guardianAssignForm.isFinancialResponsible} onChange={e => setGuardianAssignForm({...guardianAssignForm, isFinancialResponsible: e.target.checked})} />
                    Responsable económico
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}>
                    <input type="checkbox" checked={guardianAssignForm.isAuthorizedToPickUp} onChange={e => setGuardianAssignForm({...guardianAssignForm, isAuthorizedToPickUp: e.target.checked})} />
                    Autorizado a retirar
                  </label>
                  <Button variant="success-soft" onClick={() => handleSaveGuardian()} loading={assigningGuardian || updatingGuardian}>Guardar tutor</Button>
                  {/* Bug 4 fix: show override button when a 409 TUTOR_DUPLICATE_NAME was returned */}
                  {duplicateNamePending && !editingGuardianId && (
                    <Button variant="danger-soft" onClick={() => handleSaveGuardian(true)}>Confirmar de todas formas</Button>
                  )}
                </div>
              </Card>
            </div>
          )}

          {guardiansLoading ? <p>Cargando tutores...</p> : guardians.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No hay tutores asignados</p> : (
            <Table
              columns={[
                { key: 'fullName', header: 'Nombre', render: (g: Record<string, unknown>) => (
                  <span>
                    {(g.fullName as string) || '-'}
                    {' '}
                    <span style={{
                      display: 'inline-block',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      background: g.userId ? '#eff6ff' : '#f8fafc',
                      color: g.userId ? '#1d4ed8' : '#64748b',
                      border: `1px solid ${g.userId ? '#bfdbfe' : '#e2e8f0'}`,
                    }}>
                      {g.userId ? 'Con cuenta de portal' : 'Sin cuenta'}
                    </span>
                  </span>
                )},
                { key: 'relationship', header: 'Parentesco', render: (g: Record<string, unknown>) => {
                  const labels: Record<string, string> = { mother: 'Madre', father: 'Padre', legal_guardian: 'Tutor legal', other: 'Otro' };
                  return labels[g.relationship as string] ?? (g.relationship as string);
                }},
                { key: 'mobile', header: 'Móvil', render: (g: Record<string, unknown>) => (g.mobile as string) || '-' },
                { key: 'email', header: 'Email', render: (g: Record<string, unknown>) => (g.email as string) || '-' },
                { key: 'active', header: 'Estado', render: (g: Record<string, unknown>) => g.active ? '✓ Activo' : '✗ Inactivo' },
                { key: 'actions', header: '', render: (g: Record<string, unknown>) => (
                  <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                    <Button variant="action" size="sm" onClick={() => startEditGuardian(g as Parameters<typeof startEditGuardian>[0])}>Editar</Button>
                    <Button variant="danger-soft" size="sm" onClick={() => setRemoveGuardianId(g.id as string)} loading={removingGuardian}>Quitar</Button>
                  </div>
                )},
              ]}
              data={guardians}
              emptyMessage="No hay tutores"
            />
          )}

          <div style={{ marginTop: 'var(--space-md)' }}>
            <Button variant="ghost" onClick={() => setDetailStudentId(null)}>← Volver a lista</Button>
          </div>
        </Card>
      )}

      {/* ── Remove Guardian Confirmation ───────────────── */}
      {removeGuardianId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ maxWidth: 400, width: '90%' }}>
            <Card title="Quitar tutor">
              <p style={{ marginBottom: 'var(--space-md)' }}>¿Estás seguro de quitar este tutor del alumno?</p>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                <Button variant="ghost" onClick={() => setRemoveGuardianId(null)}>Cancelar</Button>
                <Button variant="danger-soft" onClick={handleRemoveGuardian}>Quitar</Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Dar de alta ingresantes aceptados ──────────── */}
      <AceptadosPanel onStudentAdded={adminReload} />
    </div>
  );
}
