import { useState, useEffect } from 'react';
import apiClient from '../../../api/client';
import { useAuth } from '../../../context/auth-context';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CourseCycleOption {
  uuid: string;
  courseName: string;
  level: number;
  modality: number | null;
}

// REAL API shape: TeacherSubjectEntry from list-teacher-subjects-in-course-cycle.use-case.ts
interface SubjectOption {
  subjectId: string;
  subjectName: string;
  studyPlanSubjectId: string | null;
}

export interface TeacherFilteredSelectionContext {
  courseCycleId: string;
  subjectId: string;
  /** Resolved from the subjects endpoint — null only on data inconsistency. */
  studyPlanSubjectId: string | null;
  level: number;
  modality: number | null;
}

/**
 * Emitted by homeroom mode: just the selected CC (no subject).
 * The page handles student-picker and grade fetching separately.
 */
export interface CourseCycleContext {
  courseCycleId: string;
  level: number;
  modality: number | null;
  courseName: string;
}

interface Props {
  /** Called in subject mode (default) when both CC + subject are selected. */
  onSelect?: (context: TeacherFilteredSelectionContext) => void;
  /**
   * Called in homeroom mode when a CC is selected.
   * Homeroom mode shows only the CC dropdown (no subject picker).
   */
  onSelectCC?: (cc: CourseCycleContext) => void;
  /** Optional filter applied to course cycles after fetch. Use for level-specific pages. */
  filterCourseCycle?: (cc: CourseCycleOption) => boolean;
  /**
   * 'subject' (default): fetch role=subject, show CC + subject dropdowns, emit TeacherFilteredSelectionContext.
   * 'homeroom': fetch role=homeroom, show CC dropdown only, emit CourseCycleContext on CC select.
   */
  role?: 'subject' | 'homeroom';
}

// ── Shared Styles ──────────────────────────────────────────────────────────────

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

const statusStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  marginTop: '0.25rem',
  color: 'var(--color-text-secondary)',
};

const errorStyle: React.CSSProperties = {
  ...statusStyle,
  color: 'var(--color-danger)',
};

const emptyStateStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  color: 'var(--color-text-secondary)',
  padding: 'var(--space-md)',
  textAlign: 'center',
};

// ── Component ──────────────────────────────────────────────────────────────────

export function TeacherFilteredSelector({ onSelect, onSelectCC, filterCourseCycle, role = 'subject' }: Props) {
  const { user } = useAuth();
  const teacherUserId = user?.id ?? '';

  // ── Level 1: Course Cycles ────────────────────────────────────────────────
  const [courseCycles, setCourseCycles] = useState<CourseCycleOption[]>([]);
  const [loadingCC, setLoadingCC] = useState(true);
  const [errorCC, setErrorCC] = useState('');
  const [selectedCCId, setSelectedCCId] = useState('');
  const [selectedCC, setSelectedCC] = useState<CourseCycleOption | null>(null);

  // ── Level 2: Subjects (subject mode only) ────────────────────────────────
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [errorSubs, setErrorSubs] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  // ── Fetch course cycles on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!teacherUserId) return;

    setLoadingCC(true);
    setErrorCC('');

    apiClient
      .get('/course-cycles', { params: { teacherUserId, role } })
      .then(r => {
        const all: CourseCycleOption[] = r.data?.data ?? [];
        setCourseCycles(filterCourseCycle ? all.filter(filterCourseCycle) : all);
      })
      .catch(() => setErrorCC('Error al cargar ciclos de curso'))
      .finally(() => setLoadingCC(false));
  }, [teacherUserId, role]);

  // ── Handle CC selection ───────────────────────────────────────────────────
  const handleCCChange = (uuid: string) => {
    setSelectedCCId(uuid);

    const cc = courseCycles.find(c => c.uuid === uuid) ?? null;
    setSelectedCC(cc);

    if (role === 'homeroom') {
      // Homeroom mode: emit CC immediately, no subject picker
      if (uuid && cc && onSelectCC) {
        onSelectCC({
          courseCycleId: uuid,
          level: cc.level,
          modality: cc.modality ?? null,
          courseName: cc.courseName,
        });
      }
      return;
    }

    // Subject mode: reset and fetch subjects
    setSelectedSubjectId('');
    setSubjects([]);
    setErrorSubs('');

    if (!uuid) return;

    setLoadingSubs(true);
    apiClient
      .get(`/course-cycles/${uuid}/subjects`, { params: { teacherUserId } })
      .then(r => setSubjects(r.data?.data ?? []))
      .catch(() => setErrorSubs('Error al cargar materias'))
      .finally(() => setLoadingSubs(false));
  };

  // ── Handle subject selection → emit full context (subject mode only) ──────
  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    if (subjectId && selectedCC && onSelect) {
      const subject = subjects.find(s => s.subjectId === subjectId) ?? null;
      onSelect({
        courseCycleId: selectedCC.uuid,
        subjectId,
        studyPlanSubjectId: subject?.studyPlanSubjectId ?? null,
        level: selectedCC.level,
        modality: selectedCC.modality ?? null,
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const ccDropdownDisabled = loadingCC || !!errorCC;
  const subDropdownDisabled = !selectedCCId || loadingSubs || !!errorSubs;

  // Empty state: finished loading, no CCs
  if (!loadingCC && !errorCC && courseCycles.length === 0) {
    return (
      <div style={emptyStateStyle} data-testid="tfs-empty-state">
        {role === 'homeroom'
          ? 'No tenés ciclos de curso a cargo'
          : 'No tenés materias asignadas'}
      </div>
    );
  }

  // Homeroom mode: show only CC dropdown (no subject picker)
  if (role === 'homeroom') {
    return (
      <div>
        <label htmlFor="tfs-cc-select" style={labelStyle}>Ciclo de Curso</label>
        <select
          id="tfs-cc-select"
          aria-label="Ciclo de Curso"
          aria-busy={loadingCC}
          value={selectedCCId}
          onChange={e => handleCCChange(e.target.value)}
          disabled={ccDropdownDisabled}
          style={selectStyle}
        >
          <option value="">{loadingCC ? 'Cargando...' : 'Seleccionar ciclo de curso...'}</option>
          {courseCycles.map(cc => (
            <option key={cc.uuid} value={cc.uuid}>{cc.courseName}</option>
          ))}
        </select>
        {errorCC && <span style={errorStyle}>{errorCC}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>

      {/* Level 1: Course Cycle */}
      <div>
        <label htmlFor="tfs-cc-select" style={labelStyle}>Ciclo de Curso</label>
        <select
          id="tfs-cc-select"
          aria-label="Ciclo de Curso"
          aria-busy={loadingCC}
          value={selectedCCId}
          onChange={e => handleCCChange(e.target.value)}
          disabled={ccDropdownDisabled}
          style={selectStyle}
        >
          <option value="">{loadingCC ? 'Cargando...' : 'Seleccionar ciclo de curso...'}</option>
          {courseCycles.map(cc => (
            <option key={cc.uuid} value={cc.uuid}>{cc.courseName}</option>
          ))}
        </select>
        {errorCC && <span style={errorStyle}>{errorCC}</span>}
      </div>

      {/* Level 2: Subject */}
      <div>
        <label htmlFor="tfs-sub-select" style={labelStyle}>Materia</label>
        <select
          id="tfs-sub-select"
          aria-label="Materia"
          aria-busy={loadingSubs}
          value={selectedSubjectId}
          onChange={e => handleSubjectChange(e.target.value)}
          disabled={subDropdownDisabled}
          style={selectStyle}
        >
          <option value="">{loadingSubs ? 'Cargando...' : 'Seleccionar materia...'}</option>
          {subjects.map(s => (
            <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>
          ))}
        </select>
        {errorSubs && <span style={errorStyle}>{errorSubs}</span>}
        {!errorSubs && subjects.length === 0 && selectedCCId && !loadingSubs && (
          <span style={statusStyle}>Sin materias asignadas en este ciclo</span>
        )}
      </div>

    </div>
  );
}

export default TeacherFilteredSelector;
