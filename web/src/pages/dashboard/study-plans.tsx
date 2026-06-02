import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { useApiList, useApiDelete, useApiCreate, useApiUpdate } from '../../hooks/use-api';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import apiClient from '../../api/client';
import StudyPlanPrintView from '../../components/reports/StudyPlanPrintView';
import { StudyPlanDetailPrintLoader } from '../../components/reports/StudyPlanDetailPrintView';
import { buildBranding } from '../../components/reports/PremiumPrintReport';
import { LEVEL_CATALOG } from '../../constants/levels';

interface StudyPlan {
  id: string;
  name: string;
  level: number;
  modality: number;
  academicYear: string;
  active: boolean;
  institutionId?: string;
}

interface PlanCourse {
  id: string;
  studyPlanId: string;
  courseSectionId: string;
  courseSectionName?: string;
  courseGrade?: string | null;
  courseDivision?: string | null;
  subjectCount: number;
}

interface PlanCourseSubject {
  id: string;
  subjectId: string;
  subjectName: string | null;
  hoursPerWeek: number | null;
}

interface CourseSection {
  id: string;
  name: string;
  grade: string | null;
  division: string | null;
  level: string;
  academicYear: string;
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Inicial', 2: 'Primario', 3: 'Secundario', 4: 'Terciario', 9: 'Administración',
};

const LEVEL_OPTIONS = [
  { value: '1', label: 'Inicial' },
  { value: '2', label: 'Primario' },
  { value: '3', label: 'Secundario' },
  { value: '4', label: 'Terciario' },
];

const MODALITY_OPTIONS = [
  { value: 'COMUN', label: 'Común' },
  { value: 'TALLERES', label: 'Talleres' },
  { value: 'BILINGÜISMO', label: 'Bilingüismo' },
];

const LEVEL_BADGE_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#e8f5e9', text: '#2e7d32' },
  2: { bg: '#e3f2fd', text: '#1565c0' },
  3: { bg: '#f3e5f5', text: '#7b1fa2' },
  4: { bg: '#fff3e0', text: '#e65100' },
  9: { bg: '#eceff1', text: '#546e7a' },
};

export default function StudyPlansPage() {
  const { user } = useAuth();
  const { config } = useInstitution();
  const isRoot = user?.roles?.includes('ROOT');

  const userInstitutionId = user?.institutionId ?? config.id ?? '';
  const [institutionId, setInstitutionId] = useState(userInstitutionId);
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    apiClient.get('/institutions').then(r => {
      const list = r.data?.data ?? [];
      setInstitutions(list);
      // ROOT: default a la primera institución
      if (isRoot && !institutionId && list.length > 0) {
        setInstitutionId(list[0].id);
      }
    }).catch(() => {});
  }, [isRoot]);

  const tenantQueryParams = institutionId ? { institutionId } : undefined;

  const { data: plans, loading, reload } = useApiList<StudyPlan>('/study-plans', tenantQueryParams);
  const { del } = useApiDelete('/study-plans');
  const { creating, createError, create } = useApiCreate<{ name: string; level: number; academicYear: string }>('/study-plans', tenantQueryParams);
  const { update } = useApiUpdate<StudyPlan>('/study-plans', tenantQueryParams);
  useApiUpdate('/course-sections', tenantQueryParams); // kept for consistency, used by apiClient directly
  useApiUpdate('/subjects', tenantQueryParams);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', level: '', academicYear: String(new Date().getFullYear()) });

  // ── Planes expandidos (múltiples, estilo acordeón) ──
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [planCourses, setPlanCourses] = useState<Record<string, PlanCourse[]>>({});
  const [expandedPlanCourses, setExpandedPlanCourses] = useState<Set<string>>(new Set());
  const [planCourseSubjects, setPlanCourseSubjects] = useState<Record<string, PlanCourseSubject[]>>({});

  const [availableCourses, setAvailableCourses] = useState<CourseSection[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');

  // ── Edición ──
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanForm, setEditPlanForm] = useState({ name: '', academicYear: '' });
  const [editingCourse, setEditingCourse] = useState<{ courseSectionId: string | null; grade: string; division: string }>({ courseSectionId: null, grade: '', division: '' });
  const [editingSubject, setEditingSubject] = useState<{ subjectId: string | null; name: string }>({ subjectId: null, name: '' });

  // ── Forms inline ──
  const [showCourseForm, setShowCourseForm] = useState<string | null>(null); // planId del curso que se está creando
  const [courseForm, setCourseForm] = useState({ grade: '', division: '' });
  const [courseFormLoading, setCourseFormLoading] = useState(false);
  const [showSubjectForm, setShowSubjectForm] = useState<string | null>(null); // planCourseId
  const [subjectForm, setSubjectForm] = useState({ name: '', modality: 'COMUN' });
  const [subjectFormLoading, setSubjectFormLoading] = useState(false);
  const [subjectFormError, setSubjectFormError] = useState('');
  const [courseFormError, setCourseFormError] = useState('');
  const [showPrint, setShowPrint] = useState(false);
  const [detailPrintPlanId, setDetailPrintPlanId] = useState<string | null>(null);

  const userLevel = user?.userLevels?.[0]?.level;
  const defaultLevel = userLevel && userLevel >= 1 && userLevel <= 4 ? String(userLevel) : '';

  useEffect(() => {
    if (defaultLevel) setForm(f => ({ ...f, level: defaultLevel }));
  }, [defaultLevel]);

  useEffect(() => {
    loadAvailableCourses();
  }, [institutionId]);

  const loadAvailableCourses = async () => {
    try {
      const res = await apiClient.get('/course-sections', { params: tenantQueryParams });
      setAvailableCourses(res.data?.data ?? []);
    } catch { setAvailableCourses([]); }
  };

  const resetForm = () => {
    setForm({ name: '', level: defaultLevel, academicYear: String(new Date().getFullYear()) });
    setShowForm(false);
  };

  // ── Crear plan ──
  const handleCreatePlan = async () => {
    const ok = await create({
      name: form.name,
      level: parseInt(form.level) || parseInt(defaultLevel) || 2,
      academicYear: form.academicYear,
    });
    if (ok) { resetForm(); reload(); }
  };

  // ── Editar plan ──
  const startEditPlan = (plan: StudyPlan) => {
    setEditingPlanId(plan.id);
    setEditPlanForm({ name: plan.name, academicYear: plan.academicYear });
  };

  const handleUpdatePlan = async () => {
    if (!editingPlanId) return;
    const ok = await update(editingPlanId, editPlanForm);
    if (ok) { setEditingPlanId(null); reload(); }
  };

  const handleDeletePlan = async (id: string) => {
    await del(id);
    reload();
  };

  // ── Fetch helpers (sin toggle, solo refrescan datos) ──
  const fetchPlanCourses = async (planId: string) => {
    try {
      const res = await apiClient.get(`/study-plans/${planId}/courses`, { params: tenantQueryParams });
      setPlanCourses(prev => ({ ...prev, [planId]: res.data?.data ?? [] }));
    } catch { /* ignore */ }
  };

  const fetchCourseSubjects = async (planCourseId: string) => {
    try {
      const res = await apiClient.get(`/study-plan-courses/${planCourseId}/subjects`, { params: tenantQueryParams });
      setPlanCourseSubjects(prev => ({ ...prev, [planCourseId]: res.data?.data ?? [] }));
    } catch { /* ignore */ }
  };

  // ── Toggle plan expansion: fetch courses ──
  const togglePlan = async (planId: string) => {
    const next = new Set(expandedPlans);
    if (next.has(planId)) {
      next.delete(planId);
      setExpandedPlans(next);
    } else {
      next.add(planId);
      setExpandedPlans(next);
      await fetchPlanCourses(planId);
    }
  };

  // ── Toggle course expansion: fetch subjects ──
  const togglePlanCourseSubjects = async (planCourseId: string) => {
    const next = new Set(expandedPlanCourses);
    if (next.has(planCourseId)) {
      next.delete(planCourseId);
      setExpandedPlanCourses(next);
    } else {
      next.add(planCourseId);
      setExpandedPlanCourses(next);
      await fetchCourseSubjects(planCourseId);
    }
  };

  // ── Create course inline ──
  const handleCreateCourseInline = async (plan: StudyPlan) => {
    setCourseFormLoading(true);
    setCourseFormError('');
    try {
      // 1. Create the course section
      const courseRes = await apiClient.post('/course-sections', {
        name: `${courseForm.grade || plan.academicYear} ${courseForm.division || ''}`.trim(),
        grade: courseForm.grade,
        division: courseForm.division,
        level: (() => {
          const compositeCode = plan.level * 10 + (plan.modality ?? 0);
          return LEVEL_CATALOG.find(e => e.code === compositeCode)?.name ?? 'PRIMARIO';
        })(),
        modality: ({
          0: 'COMUN', 1: 'TALLERES', 2: 'BILINGÜISMO', 9: 'TODOS',
        } as Record<number, string>)[plan.modality ?? 0] ?? 'COMUN',
        academicYear: plan.academicYear,
        institutionId: institutionId || undefined,
      }, { params: tenantQueryParams });
      const courseId = courseRes.data?.data?.id;
      if (courseId) {
        // 2. Link to study plan
        await apiClient.post(`/study-plans/${plan.id}/courses`, {
          courseSectionId: courseId,
        }, { params: tenantQueryParams });
        setShowCourseForm(null);
        setCourseForm({ grade: '', division: '' });
        // Refresh courses (sin colapsar el árbol)
        fetchPlanCourses(plan.id);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Error al crear el curso';
      setCourseFormError(msg);
    }
    finally { setCourseFormLoading(false); }
  };

  // ── Edit course ──
  const handleEditCourse = (pc: PlanCourse) => {
    setEditingCourse({
      courseSectionId: pc.courseSectionId,
      grade: pc.courseGrade ?? '',
      division: pc.courseDivision ?? '',
    });
  };

  const handleSaveCourse = async (planId: string) => {
    if (!editingCourse.courseSectionId) return;
    try {
      await apiClient.patch(`/course-sections/${editingCourse.courseSectionId}`, {
        grade: editingCourse.grade,
        division: editingCourse.division,
        name: `${editingCourse.grade} ${editingCourse.division}`.trim(),
      }, { params: tenantQueryParams });
      setEditingCourse({ courseSectionId: null, grade: '', division: '' });
      // Refresh (sin colapsar el árbol)
      fetchPlanCourses(planId);
    } catch { /* ignore */ }
  };

  const handleDeleteCourse = async (planId: string, courseSectionId: string) => {
    try {
      await apiClient.delete(`/study-plans/${planId}/courses/${courseSectionId}`, { params: tenantQueryParams });
      fetchPlanCourses(planId);
    } catch { /* ignore */ }
  };

  // ── Create subject inline ──
  const handleCreateSubjectInline = async (planCourseId: string, plan: StudyPlan) => {
    setSubjectFormLoading(true);
    setSubjectFormError('');
    try {
      // 1. Create the subject
      const LEVEL_MAP: Record<number, string> = { 1: 'INICIAL', 2: 'PRIMARIO', 3: 'SECUNDARIO', 4: 'TERCIARIO', 9: 'ADMINISTRACION' };
      const subRes = await apiClient.post('/subjects', {
        name: subjectForm.name,
        level: LEVEL_MAP[plan.level] ?? 'SECUNDARIO',
        modality: subjectForm.modality || 'COMUN',
        institutionId: institutionId || undefined,
      }, { params: tenantQueryParams });
      const subjectId = subRes.data?.data?.id;
      if (subjectId) {
        // 2. Link to plan course
        await apiClient.post(`/study-plan-courses/${planCourseId}/subjects`, {
          subjectId,
          hoursPerWeek: 4,
        }, { params: tenantQueryParams });
        setShowSubjectForm(null);
        setSubjectForm({ name: '', modality: 'COMUN' });
        // Refresh subjects (sin colapsar)
        fetchCourseSubjects(planCourseId);
        // Also refresh plan courses to update subjectCount (sin colapsar)
        const planId = Object.entries(planCourses).find(([, courses]) =>
          courses.some(c => c.id === planCourseId)
        )?.[0];
        if (planId) fetchPlanCourses(planId);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Error al crear la materia';
      setSubjectFormError(msg);
    }
    finally { setSubjectFormLoading(false); }
  };

  // ── Edit subject ──
  const handleEditSubject = (ps: PlanCourseSubject) => {
    setEditingSubject({
      subjectId: ps.subjectId,
      name: ps.subjectName ?? '',
    });
  };

  const handleSaveSubject = async (planCourseId: string) => {
    if (!editingSubject.subjectId) return;
    try {
      await apiClient.patch(`/subjects/${editingSubject.subjectId}`, {
        name: editingSubject.name,
      }, { params: tenantQueryParams });
      setEditingSubject({ subjectId: null, name: '' });
      fetchCourseSubjects(planCourseId);
    } catch { /* ignore */ }
  };

  const handleDeleteSubject = async (planCourseId: string, subjectId: string) => {
    try {
      await apiClient.delete(`/study-plan-courses/${planCourseId}/subjects/${subjectId}`, { params: tenantQueryParams });
      fetchCourseSubjects(planCourseId);
      const planId = Object.entries(planCourses).find(([, courses]) =>
        courses.some(c => c.id === planCourseId)
      )?.[0];
      if (planId) fetchPlanCourses(planId);
    } catch { /* ignore */ }
  };

  // ── Add existing course to plan ──
  const addCourseToPlan = async (planId: string) => {
    if (!selectedCourse) return;
    try {
      await apiClient.post(`/study-plans/${planId}/courses`, {
        courseSectionId: selectedCourse,
      }, { params: tenantQueryParams });
      setSelectedCourse('');
      fetchPlanCourses(planId);
    } catch { /* ignore */ }
  };

  if (detailPrintPlanId) {
    const plan = plans.find(p => p.id === detailPrintPlanId);
    if (plan) {
      return (
        <StudyPlanDetailPrintLoader
          branding={buildBranding(config)}
          planId={plan.id}
          planName={plan.name}
          planLevel={String(plan.level)}
          planModality={String(plan.modality)}
          planYear={plan.academicYear}
          onClose={() => setDetailPrintPlanId(null)}
        />
      );
    }
  }

  if (showPrint) {
    return (
      <StudyPlanPrintView
        branding={buildBranding(config)}
        studyPlans={plans.map(p => {
          const courses = planCourses[p.id] ?? [];
          return {
            name: p.name,
            level: String(p.level),
            modality: String(p.modality),
            academicYear: p.academicYear,
            coursesCount: courses.length,
            subjectsCount: courses.reduce((sum, c) => sum + (c.subjectCount ?? 0), 0),
            active: p.active,
          };
        })}
        onClose={() => setShowPrint(false)}
      />
    );
  }

  return (
    <div className="study-plans-page">
      <style>{`
        /* ── Page layout ── */
        .study-plans-page { max-width: 960px; margin: 0 auto; }

        /* ── Plan Card ── */
        .plan-card {
          background: #fff;
          border-radius: 12px;
          border-left: 4px solid #6366f1;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
          margin-bottom: 1rem;
          overflow: hidden;
          transition: box-shadow 0.15s;
        }
        .plan-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .plan-card-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 1rem 1.25rem; cursor: pointer; user-select: none;
        }
        .plan-card-title {
          display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
        }
        .plan-card-title strong { font-size: 1.1rem; color: #1e293b; }
        .plan-card-title .chevron {
          font-size: 0.75rem; color: #94a3b8; transition: transform 0.2s;
          display: inline-block;
        }
        .plan-card-title .chevron.open { transform: rotate(90deg); }

        /* ── Badges ── */
        .badge {
          display: inline-flex; align-items: center; gap: 0.25rem;
          padding: 0.15rem 0.55rem; border-radius: 20px;
          font-size: 0.72rem; font-weight: 500; white-space: nowrap;
        }
        .badge-year { background: #f1f5f9; color: #475569; }
        .badge-count { background: #ede9fe; color: #6d28d9; }
        .badge-institution { background: #fff7ed; color: #c2410c; }

        /* ── Course list container ── */
        .plan-courses {
          border-top: 1px solid #f1f5f9;
          background: #fafbfc;
          padding: 0.75rem 1.25rem 1rem 1.25rem;
        }
        .plan-courses h4 {
          font-size: 0.78rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.05em; color: #94a3b8; margin: 0 0 0.75rem 0;
        }

        /* ── Course Row ── */
        .course-row {
          background: #fff;
          border-radius: 8px;
          border-left: 3px solid #a5b4fc;
          margin-bottom: 0.5rem;
          overflow: hidden;
          transition: box-shadow 0.12s;
        }
        .course-row:hover { box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
        .course-row-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0.6rem 0.85rem; cursor: pointer; font-size: 0.9rem;
        }
        .course-row-header .chevron {
          font-size: 0.65rem; color: #94a3b8; transition: transform 0.2s;
          display: inline-block; margin-right: 0.4rem;
        }
        .course-row-header .chevron.open { transform: rotate(90deg); }

        /* ── Subject list ── */
        .course-subjects {
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;
          padding: 0.6rem 0.85rem 0.6rem 2rem;
        }
        .subject-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0.3rem 0; font-size: 0.82rem; color: #334155;
        }
        .subject-item .subject-actions { display: flex; gap: 0.2rem; }

        /* ── Inline forms ── */
        .inline-form {
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
          padding: 0.75rem; margin-bottom: 0.75rem;
        }
        .inline-form-row {
          display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap;
        }
        .inline-form label {
          display: block; font-size: 0.7rem; font-weight: 500;
          color: #64748b; margin-bottom: 0.2rem;
        }
        .inline-form input, .inline-form select {
          padding: 0.4rem 0.6rem; border: 1px solid #e2e8f0;
          border-radius: 6px; font-size: 0.82rem; color: #334155;
          background: #fff; outline: none; min-width: 100px;
        }
        .inline-form input:focus, .inline-form select:focus {
          border-color: #818cf8; box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
        }
        .context-hint {
          font-size: 0.7rem; color: #94a3b8; margin-top: 0.35rem;
        }

        /* ── Add existing dropdown ── */
        .add-existing-row {
          display: flex; gap: 0.5rem; margin-top: 0.75rem;
          padding-top: 0.75rem; border-top: 1px solid #f1f5f9;
          align-items: center;
        }
        .add-existing-row select {
          flex: 1; padding: 0.5rem; border: 1px solid #e2e8f0;
          border-radius: 6px; font-size: 0.82rem; color: #334155;
          background: #fff; outline: none;
        }

        /* ── Edit inline ── */
        .edit-inline-row {
          display: flex; gap: 0.4rem; align-items: flex-end; flex: 1; flex-wrap: wrap;
        }
        .edit-inline-row input {
          padding: 0.35rem 0.5rem; border: 1px solid #e2e8f0;
          border-radius: 6px; font-size: 0.82rem; color: #334155; outline: none;
        }
        .edit-inline-row input:focus {
          border-color: #818cf8; box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
        }

        /* ── Empty state ── */
        .empty-state {
          text-align: center; padding: 2.5rem; color: #94a3b8; font-size: 0.9rem;
        }

        /* ── Print ── */
        @media print {
          .no-print { display: none !important; }
          .plan-card { box-shadow: none; border-left: 2px solid #999; }
          .plan-courses { background: #fff; }
          .course-row { break-inside: avoid; box-shadow: none; }
          .plan-card-header { cursor: default; }
          .course-row-header { cursor: default; }
        }
      `}</style>

      {/* ── Header ── */}
      <PremiumHeader
        title="Planes de Estudio"
        subtitle="Gestión curricular — planes, cursos y materias"
        icon="📋"
        stats={[{ label: 'planes', value: String(plans.length) }]}
      >
        <button className="mph-btn mph-btn-print no-print" onClick={() => setShowPrint(true)}>🖨 Imprimir</button>
        <button className="mph-btn mph-btn-print no-print" onClick={() => setShowPrint(true)} style={{ background: '#fef2f2', color: '#dc2626' }}>📄 PDF</button>
        <Button variant={showForm ? 'danger-soft' : 'success-soft'} onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? 'Cancelar' : '+ Nuevo plan'}
        </Button>
      </PremiumHeader>

      {/* ── Filtro de institución ── */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Institución</label>
          {isRoot ? (
            <select
              value={institutionId}
              onChange={e => setInstitutionId(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '220px' }}
            >
              {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
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

      {/* ── Form: nuevo plan ── */}
      {showForm && (
        <Card title="Nuevo plan de estudio" className="mt-md no-print">
          {createError && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.5rem', borderRadius: '8px', marginBottom: '0.75rem', fontSize: '0.82rem' }}>{createError}</div>}
          <div className="flex flex-col gap-md">
            <Input label="Nombre del plan" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Plan de Estudios Primaria 2026" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {isRoot ? (
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 500, marginBottom: '0.25rem', display: 'block', color: '#475569' }}>Nivel educativo</label>
                  <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', background: '#fff', color: '#334155' }}>
                    <option value="">Seleccionar nivel</option>
                    {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ) : (
                <Input label="Nivel" value={LEVEL_LABELS[parseInt(form.level)] || ''} disabled />
              )}
              <Input label="Año lectivo" value={form.academicYear} onChange={e => setForm({ ...form, academicYear: e.target.value })} placeholder="2026" />
            </div>
            <Button variant="success-soft" onClick={handleCreatePlan} loading={creating}>Crear plan</Button>
          </div>
        </Card>
      )}

      {/* ── Lista de planes ── */}
      {loading ? (
        <div className="empty-state">Cargando...</div>
      ) : plans.length === 0 ? (
        <div className="empty-state">No hay planes de estudio. Creá el primero.</div>
      ) : (
        plans.map((plan: StudyPlan) => {
          const isExpanded = expandedPlans.has(plan.id);
          const courses = planCourses[plan.id] || [];
          const levelBadge = LEVEL_BADGE_COLORS[plan.level] || LEVEL_BADGE_COLORS[9];

          return (
            <div key={plan.id} className="plan-card">
              {/* ── Cabecera del plan ── */}
              <div className="plan-card-header" onClick={() => !editingPlanId && togglePlan(plan.id)}>
                <div className="plan-card-title">
                  <span className={`chevron ${isExpanded ? 'open' : ''}`}>▶</span>
                  <strong>{plan.name}</strong>
                  <span className="badge" style={{ background: levelBadge.bg, color: levelBadge.text }}>
                    {LEVEL_LABELS[plan.level] || plan.level}
                  </span>
                  <span className="badge badge-year">{plan.academicYear}</span>
                  {isRoot && plan.institutionId && (
                    <span className="badge badge-institution">
                      {institutions.find(i => i.id === plan.institutionId)?.name ?? plan.institutionId}
                    </span>
                  )}
                </div>
                <div className="plan-actions no-print" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => { togglePlan(plan.id); setDetailPrintPlanId(plan.id); }} title="Imprimir plan detallado">🖨</Button>
                  <Button variant="action" size="sm" onClick={() => startEditPlan(plan)}>Editar</Button>
                  <Button variant="danger-soft" size="sm" onClick={() => handleDeletePlan(plan.id)}>Eliminar</Button>
                </div>
              </div>

              {/* ── Edit plan inline ── */}
              {editingPlanId === plan.id && (
                <div className="inline-form no-print" style={{ margin: '0 1.25rem 0.75rem' }}>
                  <div className="inline-form-row">
                    <div>
                      <label>Nombre</label>
                      <input value={editPlanForm.name} onChange={e => setEditPlanForm({ ...editPlanForm, name: e.target.value })} />
                    </div>
                    <div>
                      <label>Año</label>
                      <input value={editPlanForm.academicYear} onChange={e => setEditPlanForm({ ...editPlanForm, academicYear: e.target.value })} style={{ width: '80px' }} />
                    </div>
                    <Button variant="success-soft" size="sm" onClick={handleUpdatePlan}>Guardar</Button>
                    <Button variant="danger-soft" size="sm" onClick={() => setEditingPlanId(null)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {/* ── Cursos del plan ── */}
              {isExpanded && (
                <div className="plan-courses">
                  <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0 }}>Cursos</h4>
                    <Button
                      variant={showCourseForm === plan.id ? 'danger-soft' : 'success-soft'}
                      size="sm"
                      onClick={() => {
                        setShowCourseForm(showCourseForm === plan.id ? null : plan.id);
                        setCourseForm({ grade: '', division: '' });
                        setCourseFormError('');
                      }}
                    >
                      {showCourseForm === plan.id ? 'Cancelar' : '+ Nuevo'}
                    </Button>
                  </div>

                  {/* Form: nuevo curso */}
                  {showCourseForm === plan.id && (
                    <div className="inline-form no-print">
                      <div className="inline-form-row">
                        <div>
                          <label>Grado / Año</label>
                          <input value={courseForm.grade} onChange={e => setCourseForm({ ...courseForm, grade: e.target.value })} placeholder="1er año" />
                        </div>
                        <div>
                          <label>División</label>
                          <input value={courseForm.division} onChange={e => setCourseForm({ ...courseForm, division: e.target.value })} placeholder="A" style={{ width: '80px' }} />
                        </div>
                        <Button variant="success-soft" size="sm" onClick={() => handleCreateCourseInline(plan)} disabled={courseFormLoading}>
                          {courseFormLoading ? 'Creando...' : 'Crear'}
                        </Button>
                      </div>
                      <div className="context-hint">
                        Hereda: {LEVEL_LABELS[plan.level]} — {plan.academicYear}
                      </div>
                      {courseFormError && (
                        <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.35rem' }}>{courseFormError}</div>
                      )}
                    </div>
                  )}

                  {/* Lista de cursos */}
                  {courses.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', padding: '0.75rem 0' }}>
                      Sin cursos. Creá uno nuevo o agregá uno existente.
                    </p>
                  ) : (
                    courses.map((pc: PlanCourse) => {
                      const isCourseExpanded = expandedPlanCourses.has(pc.id);
                      const isEditingCourse = editingCourse.courseSectionId === pc.courseSectionId;
                      const subjects = planCourseSubjects[pc.id] || [];

                      return (
                        <div key={pc.id} className="course-row">
                          <div className="course-row-header" onClick={() => !isEditingCourse && togglePlanCourseSubjects(pc.id)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className={`chevron ${isCourseExpanded ? 'open' : ''}`}>▶</span>
                              <span style={{ fontWeight: 500 }}>{pc.courseSectionName || pc.courseSectionId}</span>
                              {pc.subjectCount > 0 && (
                                <span className="badge badge-count">{pc.subjectCount} {pc.subjectCount === 1 ? 'materia' : 'materias'}</span>
                              )}
                            </div>
                            <div className="no-print" style={{ display: 'flex', gap: '0.2rem' }} onClick={e => e.stopPropagation()}>
                              <Button variant="action" size="sm" onClick={() => handleEditCourse(pc)}>Editar</Button>
                              <Button variant="danger-soft" size="sm" onClick={() => handleDeleteCourse(plan.id, pc.courseSectionId)}>Eliminar</Button>
                            </div>
                          </div>

                          {/* Edit course inline */}
                          {isEditingCourse && (
                            <div className="no-print" style={{ padding: '0.5rem 0.85rem 0.5rem 2rem' }}>
                              <div className="inline-form">
                                <div className="inline-form-row">
                                  <div>
                                    <label>Grado / Año</label>
                                    <input value={editingCourse.grade} onChange={e => setEditingCourse({ ...editingCourse, grade: e.target.value })} placeholder="1er año" />
                                  </div>
                                  <div>
                                    <label>División</label>
                                    <input value={editingCourse.division} onChange={e => setEditingCourse({ ...editingCourse, division: e.target.value })} placeholder="A" style={{ width: '80px' }} />
                                  </div>
                                  <Button variant="success-soft" size="sm" onClick={() => handleSaveCourse(plan.id)}>Guardar</Button>
                                  <Button variant="danger-soft" size="sm" onClick={() => setEditingCourse({ courseSectionId: null, grade: '', division: '' })}>Cancelar</Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Materias del curso */}
                          {isCourseExpanded && (
                            <div className="course-subjects">
                              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Materias</span>
                                <Button
                                  variant={showSubjectForm === pc.id ? 'danger-soft' : 'success-soft'}
                                  size="sm"
                                  onClick={() => {
                                    setShowSubjectForm(showSubjectForm === pc.id ? null : pc.id);
                                    setSubjectForm({ name: '', modality: 'COMUN' });
                                    setSubjectFormError('');
                                  }}
                                >
                                  {showSubjectForm === pc.id ? 'Cancelar' : '+ Nueva'}
                                </Button>
                              </div>

                              {/* Form: nueva materia */}
                              {showSubjectForm === pc.id && (
                                <div className="inline-form no-print" style={{ marginBottom: '0.5rem' }}>
                                  <div className="inline-form-row">
                                    <div>
                                      <label>Nombre</label>
                                      <input value={subjectForm.name} onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })} placeholder="Matemática" />
                                    </div>
                                    <div>
                                      <label>Modalidad</label>
                                      <select value={subjectForm.modality} onChange={e => setSubjectForm({ ...subjectForm, modality: e.target.value })}>
                                        {MODALITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                      </select>
                                    </div>
                                    <Button variant="success-soft" size="sm" onClick={() => handleCreateSubjectInline(pc.id, plan)} disabled={subjectFormLoading}>
                                      {subjectFormLoading ? 'Creando...' : 'Crear'}
                                    </Button>
                                  </div>
                                  <div className="context-hint">Nivel: {LEVEL_LABELS[plan.level]}</div>
                                  {subjectFormError && (
                                    <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.35rem' }}>{subjectFormError}</div>
                                  )}
                                </div>
                              )}

                              {subjects.length === 0 ? (
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sin materias.</p>
                              ) : (
                                subjects.map((ps: PlanCourseSubject) => {
                                  const isEditingSubj = editingSubject.subjectId === ps.subjectId;
                                  return (
                                    <div key={ps.id} className="subject-item">
                                      {isEditingSubj ? (
                                        <div className="edit-inline-row no-print" style={{ flex: 1 }}>
                                          <input value={editingSubject.name} onChange={e => setEditingSubject({ ...editingSubject, name: e.target.value })} style={{ flex: 1 }} />
                                          <Button variant="success-soft" size="sm" onClick={() => handleSaveSubject(pc.id)}>Guardar</Button>
                                          <Button variant="danger-soft" size="sm" onClick={() => setEditingSubject({ subjectId: null, name: '' })}>Cancelar</Button>
                                        </div>
                                      ) : (
                                        <>
                                          <span>{ps.subjectName || ps.subjectId}</span>
                                          <div className="subject-actions no-print">
                                            <Button variant="action" size="sm" onClick={() => handleEditSubject(ps)}>Editar</Button>
                                            <Button variant="danger-soft" size="sm" onClick={() => handleDeleteSubject(pc.id, ps.subjectId)}>Eliminar</Button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  );
                                })
                              )}

                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Agregar curso existente */}
                  {availableCourses.filter((c) => !courses.find((pc) => pc.courseSectionId === c.id)).length > 0 && (
                    <div className="add-existing-row no-print">
                      <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
                        <option value="">+ Agregar curso existente...</option>
                        {availableCourses
                          .filter((c) => !courses.find((pc) => pc.courseSectionId === c.id))
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.name} — {c.level}</option>
                          ))}
                      </select>
                      <Button variant="success-soft" size="sm" onClick={() => addCourseToPlan(plan.id)} disabled={!selectedCourse}>Agregar</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
