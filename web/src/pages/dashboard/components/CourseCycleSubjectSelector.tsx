import { useState, useEffect } from 'react';
import apiClient from '../../../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AcademicCycleOption {
  uuid: string;
  name: string;
  code?: string;
  level?: number;
  modality?: number;
  active?: boolean;
}

interface CourseCycleOption {
  uuid: string;
  courseName: string;
  level?: number;
  active?: boolean;
}

interface SubjectOption {
  id: string;
  subjectId?: string;
  subjectName: string | null;
}

export interface CourseCycleSelectionContext {
  courseCycleId: string;
  studyPlanId: string;
  studyPlanSubjectId: string;
  level: number;
  modality: number | null;
}

interface Props {
  onSelect: (context: CourseCycleSelectionContext) => void;
}

// ── Shared Styles ─────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export function CourseCycleSubjectSelector({ onSelect }: Props) {
  // ── Level 1: Academic Cycles ──────────────────────────────────────────────
  const [academicCycles, setAcademicCycles] = useState<AcademicCycleOption[]>([]);
  const [loadingAC, setLoadingAC] = useState(false);
  const [errorAC, setErrorAC] = useState('');
  const [selectedACId, setSelectedACId] = useState('');

  // ── Level 2: Course Cycles ────────────────────────────────────────────────
  const [courseCycles, setCourseCycles] = useState<CourseCycleOption[]>([]);
  const [loadingCC, setLoadingCC] = useState(false);
  const [errorCC, setErrorCC] = useState('');
  const [selectedCCId, setSelectedCCId] = useState('');

  // Course cycle detail (level, modality, studyPlanId)
  const [ccLevel, setCCLevel] = useState<number | null>(null);
  const [ccModality, setCCModality] = useState<number | null>(null);
  const [ccStudyPlanId, setCCStudyPlanId] = useState('');

  // ── Level 3: Subjects ─────────────────────────────────────────────────────
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [errorSubs, setErrorSubs] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  // ── Fetch academic cycles on mount ────────────────────────────────────────
  useEffect(() => {
    setLoadingAC(true);
    setErrorAC('');
    apiClient
      .get('/academic-cycles')
      .then(r => setAcademicCycles(r.data?.data ?? []))
      .catch(() => setErrorAC('Error al cargar ciclos lectivos'))
      .finally(() => setLoadingAC(false));
  }, []);

  // ── Fetch course cycles when academic cycle changes ───────────────────────
  const fetchCourseCycles = (academicCycleId: string) => {
    setLoadingCC(true);
    setErrorCC('');
    setCourseCycles([]);
    apiClient
      .get('/course-cycles', { params: { academicCycleId } })
      .then(r => setCourseCycles(r.data?.data ?? []))
      .catch(() => setErrorCC('Error al cargar ciclos de curso'))
      .finally(() => setLoadingCC(false));
  };

  const handleACChange = (uuid: string) => {
    setSelectedACId(uuid);
    setSelectedCCId('');
    setSelectedSubjectId('');
    setCourseCycles([]);
    setSubjects([]);
    setCCLevel(null);
    setCCModality(null);
    setCCStudyPlanId('');
    setErrorCC('');
    setErrorSubs('');

    if (!uuid) return;
    fetchCourseCycles(uuid);
  };

  const handleRetryCC = () => {
    if (!selectedACId) return;
    fetchCourseCycles(selectedACId);
  };

  // ── Fetch CC detail + subjects when course cycle changes ──────────────────
  const handleCCChange = (uuid: string) => {
    setSelectedCCId(uuid);
    setSelectedSubjectId('');
    setSubjects([]);
    setCCLevel(null);
    setCCModality(null);
    setCCStudyPlanId('');
    setErrorSubs('');

    if (!uuid) return;
    setLoadingSubs(true);
    apiClient
      .get(`/course-cycles/${uuid}`)
      .then(async r => {
        const cycle = r.data?.data;
        if (!cycle) return;
        const level: number = cycle.level;
        const modality: number | null = cycle.modality ?? null;
        const studyPlanId: string = cycle.studyPlanId;
        setCCLevel(level);
        setCCModality(modality);
        setCCStudyPlanId(studyPlanId);

        // Fetch study plan to get subjects
        const planR = await apiClient.get(`/study-plans/${studyPlanId}`);
        const plan = planR.data?.data;
        const flatSubjects: SubjectOption[] = (plan?.courses ?? []).flatMap(
          (c: { subjects?: SubjectOption[] }) => c.subjects ?? [],
        );
        setSubjects(flatSubjects);
      })
      .catch(() => setErrorSubs('Error al cargar materias'))
      .finally(() => setLoadingSubs(false));
  };

  // ── Subject selection → emit full context ─────────────────────────────────
  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    if (subjectId && selectedCCId && ccStudyPlanId && ccLevel !== null) {
      onSelect({
        courseCycleId: selectedCCId,
        studyPlanId: ccStudyPlanId,
        studyPlanSubjectId: subjectId,
        level: ccLevel,
        modality: ccModality,
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const ccDropdownDisabled = !selectedACId || loadingCC || !!errorCC;
  const subDropdownDisabled = !selectedCCId || loadingSubs || !!errorSubs || subjects.length === 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>

      {/* Level 1: Academic Cycle */}
      <div>
        <label htmlFor="ccss-ac-select" style={labelStyle}>Ciclo Lectivo</label>
        <select
          id="ccss-ac-select"
          aria-label="Ciclo Lectivo"
          aria-busy={loadingAC}
          value={selectedACId}
          onChange={e => handleACChange(e.target.value)}
          disabled={loadingAC}
          style={selectStyle}
        >
          <option value="">{loadingAC ? 'Cargando...' : 'Seleccionar ciclo...'}</option>
          {academicCycles.map(ac => (
            <option key={ac.uuid} value={ac.uuid}>{ac.name}</option>
          ))}
        </select>
        {errorAC && <span style={errorStyle}>{errorAC}</span>}
      </div>

      {/* Level 2: Course Cycle */}
      <div>
        <label htmlFor="ccss-cc-select" style={labelStyle}>Ciclo de Curso</label>
        <select
          id="ccss-cc-select"
          aria-label="Ciclo de Curso"
          aria-disabled={ccDropdownDisabled}
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
        {errorCC && (
          <div>
            <span style={errorStyle}>{errorCC}</span>
            <button
              type="button"
              aria-label="Reintentar"
              onClick={handleRetryCC}
              style={{ marginLeft: '0.5rem', fontSize: 'var(--text-xs)', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Reintentar
            </button>
          </div>
        )}
        {!errorCC && courseCycles.length === 0 && selectedACId && !loadingCC && (
          <span style={statusStyle}>Sin ciclos disponibles</span>
        )}
      </div>

      {/* Level 3: Subject */}
      <div>
        <label htmlFor="ccss-sub-select" style={labelStyle}>Materia</label>
        <select
          id="ccss-sub-select"
          aria-label="Materia"
          aria-disabled={subDropdownDisabled}
          aria-busy={loadingSubs}
          value={selectedSubjectId}
          onChange={e => handleSubjectChange(e.target.value)}
          disabled={subDropdownDisabled}
          style={selectStyle}
        >
          <option value="">{loadingSubs ? 'Cargando...' : 'Seleccionar materia...'}</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.subjectName ?? s.id}</option>
          ))}
        </select>
        {errorSubs && <span style={errorStyle}>{errorSubs}</span>}
      </div>

    </div>
  );
}

export default CourseCycleSubjectSelector;
