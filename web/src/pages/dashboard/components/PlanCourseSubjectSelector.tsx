import { useState, useEffect } from 'react';
import apiClient from '../../../api/client';

// ── Types ────────────────────────────────────────────────────

interface StudyPlanSummary {
  id: string;
  name: string;
}

interface StudyPlanSubjectDto {
  id: string;           // IS the studyPlanSubjectId
  subjectId: string;
  subjectName: string | null;
}

interface StudyPlanCourseDto {
  id: string;
  courseSectionName?: string;
  subjects: StudyPlanSubjectDto[];
}

interface StudyPlanDetail {
  id: string;
  name: string;
  courses: StudyPlanCourseDto[];
}

// ── Props ────────────────────────────────────────────────────

interface Props {
  onSubjectSelect: (studyPlanSubjectId: string) => void;
}

// ── Component ────────────────────────────────────────────────

export function PlanCourseSubjectSelector({ onSubjectSelect }: Props) {
  const [plans, setPlans] = useState<StudyPlanSummary[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planDetail, setPlanDetail] = useState<StudyPlanDetail | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);

  useEffect(() => {
    setLoadingPlans(true);
    apiClient
      .get('/study-plans')
      .then(r => setPlans(r.data?.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, []);

  const handlePlanChange = async (planId: string) => {
    setSelectedPlanId(planId);
    setSelectedCourseId('');
    setSelectedSubjectId('');
    setPlanDetail(null);
    onSubjectSelect('');
    if (!planId) return;
    setLoadingPlan(true);
    try {
      const r = await apiClient.get(`/study-plans/${planId}`);
      setPlanDetail(r.data?.data ?? null);
    } catch { /* ignore */ }
    finally { setLoadingPlan(false); }
  };

  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedSubjectId('');
    onSubjectSelect('');
  };

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    onSubjectSelect(subjectId);
  };

  const courses = planDetail?.courses ?? [];
  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const subjects = selectedCourse?.subjects ?? [];

  const selectStyle: React.CSSProperties = {
    padding: '0.5rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 'var(--text-sm)',
    width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    marginBottom: '0.25rem',
    display: 'block',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
      {/* Plan selector */}
      <div>
        <label htmlFor="pcs-plan-select" style={labelStyle}>Plan de estudios</label>
        <select
          id="pcs-plan-select"
          aria-label="Plan de estudios"
          value={selectedPlanId}
          onChange={e => handlePlanChange(e.target.value)}
          disabled={loadingPlans}
          style={selectStyle}
        >
          <option value="">Seleccionar plan...</option>
          {plans.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Course selector */}
      <div>
        <label htmlFor="pcs-course-select" style={labelStyle}>Curso</label>
        <select
          id="pcs-course-select"
          aria-label="Curso"
          value={selectedCourseId}
          onChange={e => handleCourseChange(e.target.value)}
          disabled={!planDetail || loadingPlan}
          style={selectStyle}
        >
          <option value="">Seleccionar curso...</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.courseSectionName ?? c.id}</option>
          ))}
        </select>
      </div>

      {/* Subject selector */}
      <div>
        <label htmlFor="pcs-subject-select" style={labelStyle}>Materia</label>
        <select
          id="pcs-subject-select"
          aria-label="Materia"
          value={selectedSubjectId}
          onChange={e => handleSubjectChange(e.target.value)}
          disabled={!selectedCourseId || subjects.length === 0}
          style={selectStyle}
        >
          <option value="">Seleccionar materia...</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.subjectName ?? s.id}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default PlanCourseSubjectSelector;
