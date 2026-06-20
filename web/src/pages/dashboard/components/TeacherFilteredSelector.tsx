import { useState, useEffect } from 'react';
import apiClient from '../../../api/client';
import { useAuth } from '../../../context/auth-context';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CourseCycleOption {
  uuid: string;
  courseName: string;
  level: number;
  modality: number | null;
  /** AcademicCycle.uuid — used by StudentObservationsPanel for academicCycleId (SDD-2 R15). */
  cycleId?: string;
}

interface InstitutionOption {
  id: string;
  name: string;
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
  /** Populated for ROOT; undefined for non-ROOT. */
  institutionId?: string;
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
  /** Populated for ROOT; undefined for non-ROOT. */
  institutionId?: string;
  /** AcademicCycle.uuid — passed from CourseCycle.cycleId (SDD-2 R15). */
  academicCycleId?: string;
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
  const isRoot = user?.roles?.includes('ROOT') ?? false;
  const teacherUserId = user?.id ?? '';

  // ── ROOT: Institution state ────────────────────────────────────────────────
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [institutionId, setInstitutionId] = useState('');
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);

  // ── Level 1: Course Cycles ────────────────────────────────────────────────
  // ROOT starts not-loading (waits for institution); non-ROOT starts loading (immediate fetch)
  const [courseCycles, setCourseCycles] = useState<CourseCycleOption[]>([]);
  const [loadingCC, setLoadingCC] = useState(!isRoot && !!teacherUserId);
  const [errorCC, setErrorCC] = useState('');
  const [selectedCCId, setSelectedCCId] = useState('');
  const [selectedCC, setSelectedCC] = useState<CourseCycleOption | null>(null);

  // ── Level 2: Subjects (subject mode only) ────────────────────────────────
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [errorSubs, setErrorSubs] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  // ── Fetch institutions for ROOT on mount ──────────────────────────────────
  useEffect(() => {
    if (!isRoot) return;
    setLoadingInstitutions(true);
    apiClient
      .get('/institutions')
      .then(r => setInstitutions(r.data?.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingInstitutions(false));
  }, [isRoot]);

  // ── Fetch course cycles when institution / identity / role changes ─────────
  useEffect(() => {
    // Reset CC cascade on any trigger change
    setCourseCycles([]);
    setSelectedCCId('');
    setSelectedCC(null);
    setErrorCC('');
    setSubjects([]);
    setSelectedSubjectId('');

    if (isRoot) {
      if (!institutionId) {
        setLoadingCC(false);
        return;
      }
      setLoadingCC(true);
      apiClient
        .get('/course-cycles', { params: { institutionId, role } })
        .then(r => {
          const all: CourseCycleOption[] = r.data?.data ?? [];
          setCourseCycles(filterCourseCycle ? all.filter(filterCourseCycle) : all);
        })
        .catch(() => setErrorCC('Error al cargar ciclos de curso'))
        .finally(() => setLoadingCC(false));
    } else {
      if (!teacherUserId) return;
      setLoadingCC(true);
      apiClient
        .get('/course-cycles', { params: { teacherUserId, role } })
        .then(r => {
          const all: CourseCycleOption[] = r.data?.data ?? [];
          setCourseCycles(filterCourseCycle ? all.filter(filterCourseCycle) : all);
        })
        .catch(() => setErrorCC('Error al cargar ciclos de curso'))
        .finally(() => setLoadingCC(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterCourseCycle is a stable module-level fn; including it causes spurious re-fetches
  }, [isRoot, institutionId, teacherUserId, role]);

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
          institutionId: isRoot ? institutionId || undefined : undefined,
          academicCycleId: cc.cycleId,
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
    const subjectParams = isRoot ? { institutionId } : { teacherUserId };
    apiClient
      .get(`/course-cycles/${uuid}/subjects`, { params: subjectParams })
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
        institutionId: isRoot ? institutionId || undefined : undefined,
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const ccDropdownDisabled = loadingCC || !!errorCC;
  const subDropdownDisabled = !selectedCCId || loadingSubs || !!errorSubs;

  // Institution combobox — rendered for ROOT only (null for non-ROOT)
  const institutionCombobox = isRoot ? (
    <div>
      <label htmlFor="tfs-institution-select" style={labelStyle}>Institución</label>
      <select
        id="tfs-institution-select"
        aria-label="Institución"
        value={institutionId}
        onChange={e => setInstitutionId(e.target.value)}
        disabled={loadingInstitutions}
        style={selectStyle}
      >
        <option value="">{loadingInstitutions ? 'Cargando...' : 'Seleccionar institución...'}</option>
        {institutions.map(inst => (
          <option key={inst.id} value={inst.id}>{inst.name}</option>
        ))}
      </select>
    </div>
  ) : null;

  // ROOT with no institution selected: show institution picker + prompt; no CC dropdown yet
  if (isRoot && !institutionId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {institutionCombobox}
        <div style={emptyStateStyle} data-testid="tfs-institution-prompt">
          Seleccioná una institución para ver los ciclos de curso
        </div>
      </div>
    );
  }

  // Empty state: finished loading, no CCs
  if (!loadingCC && !errorCC && courseCycles.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {institutionCombobox}
        <div style={emptyStateStyle} data-testid="tfs-empty-state">
          {role === 'homeroom'
            ? 'No tenés ciclos de curso a cargo'
            : 'No tenés materias asignadas'}
        </div>
      </div>
    );
  }

  // Homeroom mode: show institution combobox (ROOT) + CC dropdown only
  if (role === 'homeroom') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {institutionCombobox}
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
      </div>
    );
  }

  // Subject mode: institution combobox (ROOT) + CC + subject dropdowns
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {institutionCombobox}
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
    </div>
  );
}

export default TeacherFilteredSelector;
