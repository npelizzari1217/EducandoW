/**
 * PR5-T8 [GREEN] — SubjectGradingByCourse page ("Alumnos por Curso").
 *
 * Generalized for Primario + Secundario (was Primario-only in original implementation).
 *
 * Features:
 * - TeacherFilteredSelector in homeroom mode (Primario + Secundario) → emits CC
 * - Student list fetched from /course-cycles/:id/students
 * - Action modal: Calificaciones / Observaciones / Legajo per student
 *
 * Filter: Math.floor(level/10) ∈ {2, 3} (levels 20-39 — Primario + Secundario)
 * Specs: ESS-R2, ESS-R6, ESS-R7, ESS-R8, ESS-R10, TIA-R9, D3
 */
import { useState, useEffect } from 'react';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import apiClient from '../../api/client';
import { TeacherFilteredSelector } from './components/TeacherFilteredSelector';
import type { CourseCycleContext } from './components/TeacherFilteredSelector';
import { useStudentGrades } from './components/use-student-grades';
import { StudentLegajo } from './components/StudentLegajo';
import { StudentObservationsPanel } from './components/StudentObservationsPanel';

// ── Constants ──────────────────────────────────────────────────────────────────

const FINAL_TYPES = ['FINAL', 'DICIEMBRE', 'MARZO', 'DEFINITIVA'] as const;

const FINAL_TYPE_LABELS: Record<typeof FINAL_TYPES[number], string> = {
  FINAL: 'Nota Final',
  DICIEMBRE: 'Diciembre',
  MARZO: 'Marzo',
  DEFINITIVA: 'Definitiva',
};

/** All student levels: Inicial(1x), Primario(2x), Secundario(3x), Terciario(4x) — excludes admin(9x) */
const isStudentLevel = (cc: { level: number }) =>
  [1, 2, 3, 4].includes(Math.floor(cc.level / 10));

// ── Types ──────────────────────────────────────────────────────────────────────

interface EnrolledStudent {
  studentId: string;
  firstName: string;
  lastName: string;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 'var(--text-sm)',
  overflowX: 'auto',
};

const thStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  textAlign: 'left',
  fontWeight: 600,
  background: 'var(--color-surface-secondary, var(--color-surface))',
  borderBottom: '2px solid var(--color-border)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '0.35rem 0.5rem',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'middle',
};

const selectStyle: React.CSSProperties = {
  padding: '0.2rem 0.35rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: 'var(--text-sm)',
  minWidth: '5rem',
};

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 'var(--text-md)',
  marginBottom: 'var(--space-sm)',
  color: 'var(--color-text)',
};

const errorStyle: React.CSSProperties = {
  padding: 'var(--space-lg)',
  textAlign: 'center',
  color: 'var(--color-danger)',
};

const emptyStyle: React.CSSProperties = {
  padding: 'var(--space-lg)',
  textAlign: 'center',
  color: 'var(--color-text-secondary)',
};

// ── Inner: StudentGradingGrid ──────────────────────────────────────────────────

interface StudentGradingGridProps {
  courseCycleId: string;
  studentId: string;
  level: number;
  modality: number | null;
  institutionId?: string;
}

function StudentGradingGrid({ courseCycleId, studentId, level, modality, institutionId }: StudentGradingGridProps) {
  const { loading, error, subjects, scaleValues, updatePeriodGrade, updateFinalGrade, updateCompetencyGrade } =
    useStudentGrades({ courseCycleId, studentId, level, modality, institutionId });

  // Which subject's competencies are shown below (defaults to the first subject)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  // Which competency row is highlighted (visual only — to track what you're grading)
  const [selectedValuationId, setSelectedValuationId] = useState<string | null>(null);

  if (loading) {
    return (
      <Card className="mt-lg">
        <div data-testid="grid-loading" style={emptyStyle}>
          Cargando calificaciones...
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-lg">
        <div style={errorStyle}>{error}</div>
      </Card>
    );
  }

  if (subjects.length === 0) {
    return (
      <Card className="mt-lg">
        <div style={emptyStyle}>No hay materias configuradas para este ciclo de curso.</div>
      </Card>
    );
  }

  // Period columns derived from first subject (all subjects share periods in a course)
  const periodColumns = subjects[0]?.periods ?? [];

  // Active subject drives which competencies are shown below (defaults to the first)
  const activeSubjectId = selectedSubjectId ?? subjects[0]?.subjectId ?? null;
  const activeSubject = subjects.find((s) => s.subjectId === activeSubjectId) ?? null;

  return (
    <Card className="mt-lg">
      {/* ── Table 1: Materias ──────────────────────────────────────────────── */}
      <p style={sectionTitleStyle}>Materias</p>
      <div data-testid="materias-table" style={{ overflowX: 'auto' }}>
        <table style={tableStyle} role="grid" aria-label="Calificaciones por materia">
          <thead>
            <tr>
              <th style={thStyle}>Materia</th>
              {periodColumns.map((p) => (
                <th key={p.periodOrdinal} style={thStyle}>{p.periodName}</th>
              ))}
              {FINAL_TYPES.map((type) => (
                <th key={type} style={thStyle}>{FINAL_TYPE_LABELS[type]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => (
              <tr
                key={subject.subjectId}
                onClick={() => setSelectedSubjectId(subject.subjectId)}
                style={{
                  cursor: 'pointer',
                  background: subject.subjectId === activeSubjectId ? 'var(--color-row-selected)' : undefined,
                }}
              >
                <td style={{ ...tdStyle, fontWeight: 500 }}>{subject.subjectName}</td>
                {periodColumns.map((p) => {
                  const grade = subject.periodGrades.find((g) => g.periodOrdinal === p.periodOrdinal);
                  return (
                    <td key={p.periodOrdinal} style={tdStyle}>
                      <select
                        style={selectStyle}
                        aria-label={`Nota período ${p.periodOrdinal} - ${subject.subjectId}`}
                        value={grade?.gradeScaleValueId ?? ''}
                        onChange={(e) =>
                          updatePeriodGrade(subject.subjectId, p.periodOrdinal, {
                            gradeScaleValueId: e.target.value || null,
                          })
                        }
                      >
                        <option value="">—</option>
                        {scaleValues.map((sv) => (
                          <option key={sv.id} value={sv.id}>{sv.label}</option>
                        ))}
                      </select>
                    </td>
                  );
                })}
                {FINAL_TYPES.map((type) => {
                  const fg = subject.finalGrades.find((f) => f.type === type);
                  return (
                    <td key={type} style={tdStyle}>
                      <select
                        style={selectStyle}
                        aria-label={`${FINAL_TYPE_LABELS[type]} - ${subject.subjectId}`}
                        value={fg?.gradeScaleValueId ?? ''}
                        onChange={(e) =>
                          updateFinalGrade(subject.subjectId, type, {
                            gradeScaleValueId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">—</option>
                        {scaleValues.map((sv) => (
                          <option key={sv.id} value={sv.id}>{sv.label}</option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Table 2: Competencias de la materia seleccionada ───────────────── */}
      {activeSubject && activeSubject.competencyValuations.length > 0 && (
        <>
          <p style={{ ...sectionTitleStyle, marginTop: 'var(--space-lg)' }}>
            Competencias — {activeSubject.subjectName}
          </p>
          <div data-testid="competencias-table" style={{ overflowX: 'auto' }}>
            <table style={tableStyle} role="grid" aria-label="Calificaciones por competencia">
              <thead>
                <tr>
                  <th style={thStyle}>Competencia</th>
                  {periodColumns.map((p) => (
                    <th key={p.periodOrdinal} style={thStyle}>{p.periodName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeSubject.competencyValuations.map((cv) => (
                  <tr
                    key={cv.valuationId}
                    onClick={() => setSelectedValuationId(cv.valuationId)}
                    style={{
                      cursor: 'pointer',
                      background: cv.valuationId === selectedValuationId ? 'var(--color-row-selected)' : undefined,
                    }}
                  >
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{cv.competencyName}</td>
                    {/* Map positionally: periodValuations[i] aligns with periodColumns[i] */}
                    {periodColumns.map((p, idx) => {
                      const pv = cv.periodValuations[idx];
                      return (
                        <td key={p.periodOrdinal} style={tdStyle}>
                          {pv && (
                            <select
                              style={selectStyle}
                              aria-label={`Competencia ${cv.valuationId} período ${p.periodOrdinal}`}
                              value={pv.gradeScaleValueId ?? ''}
                              onChange={(e) =>
                                updateCompetencyGrade(cv.valuationId, pv.periodItemId, e.target.value || null)
                              }
                            >
                              <option value="">—</option>
                              {scaleValues.map((sv) => (
                                <option key={sv.id} value={sv.id}>{sv.label}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

// ── Action Registry ────────────────────────────────────────────────────────────

interface StudentAction {
  key: string;
  label: string;
  render: (
    student: EnrolledStudent,
    ctx: {
      courseCycleId: string;
      level: number;
      modality: number | null;
      institutionId?: string;
      /** SDD-2 R15: AcademicCycle.uuid for StudentObservationsPanel. */
      academicCycleId?: string;
    },
  ) => React.ReactNode;
}

const STUDENT_ACTIONS: StudentAction[] = [
  {
    key: 'grades',
    label: 'Calificaciones',
    render: (s, ctx) => (
      <StudentGradingGrid
        courseCycleId={ctx.courseCycleId}
        studentId={s.studentId}
        level={ctx.level}
        modality={ctx.modality}
        institutionId={ctx.institutionId}
      />
    ),
  },
  {
    key: 'obs-pedagogicas',
    label: 'Observaciones Pedagógicas',
    render: (s, ctx) => (
      <StudentObservationsPanel
        studentId={s.studentId}
        institutionId={ctx.institutionId}
        type="PEDAGOGICAL"
        academicCycleId={ctx.academicCycleId}
      />
    ),
  },
  {
    key: 'obs-psico',
    label: 'Observaciones Psicopedagógicas',
    render: (s, ctx) => (
      <StudentObservationsPanel
        studentId={s.studentId}
        institutionId={ctx.institutionId}
        type="PSYCHOPEDAGOGICAL"
      />
    ),
  },
  {
    key: 'legajo',
    label: 'Legajo',
    render: (s, ctx) => (
      <StudentLegajo
        studentId={s.studentId}
        institutionId={ctx.institutionId}
      />
    ),
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubjectGradingByCoursePage() {
  const [ccContext, setCCContext] = useState<CourseCycleContext | null>(null);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [modalState, setModalState] = useState<{
    student: EnrolledStudent;
    action: StudentAction;
  } | null>(null);

  // ── Fetch students when CC is selected ────────────────────────────────────
  useEffect(() => {
    if (!ccContext) return;
    setStudentsLoading(true);
    setStudents([]);

    apiClient
      .get(
        `/course-cycles/${ccContext.courseCycleId}/students`,
        ccContext.institutionId ? { params: { institutionId: ccContext.institutionId } } : undefined,
      )
      .then((r) => setStudents((r.data as { data?: EnrolledStudent[] })?.data ?? []))
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false));
  }, [ccContext]);

  const handleCCSelect = (cc: CourseCycleContext) => {
    setCCContext(cc);
    setModalState(null);
  };

  return (
    <div>
      <PremiumHeader
        title="Alumnos por Curso"
        subtitle="Seleccioná un curso para ver los alumnos y sus acciones"
        icon="📋"
      />

      {/* Homeroom CC selector — Primario + Secundario */}
      <Card className="mt-md">
        <TeacherFilteredSelector
          role="homeroom"
          onSelectCC={handleCCSelect}
          filterCourseCycle={isStudentLevel}
        />
      </Card>

      {/* Student list — shown only when CC is selected */}
      {ccContext && (
        <Card className="mt-md">
          <div data-testid="student-list">
            {studentsLoading && (
              <p style={{ padding: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>
                Cargando alumnos...
              </p>
            )}
            {!studentsLoading && students.length === 0 && (
              <p style={{ padding: 'var(--space-md)', color: 'var(--color-text-secondary)' }}>
                No hay alumnos en este curso.
              </p>
            )}
            {!studentsLoading && students.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Apellido</th>
                      <th style={thStyle}>Nombre</th>
                      <th style={thStyle}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.studentId}>
                        <td style={tdStyle}>{s.lastName}</td>
                        <td style={tdStyle}>{s.firstName}</td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                            {STUDENT_ACTIONS.map((action) => (
                              <Button
                                key={action.key}
                                variant="action"
                                size="sm"
                                onClick={() => setModalState({ student: s, action })}
                              >
                                {action.label}
                              </Button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Action modal */}
      <Modal
        open={modalState !== null}
        title={
          modalState
            ? `${modalState.action.label} — ${modalState.student.firstName} ${modalState.student.lastName}`
            : ''
        }
        onClose={() => setModalState(null)}
        size="xl"
      >
        {modalState &&
          modalState.action.render(modalState.student, {
            courseCycleId: ccContext!.courseCycleId,
            level: ccContext!.level,
            modality: ccContext!.modality,
            institutionId: ccContext!.institutionId,
            academicCycleId: ccContext!.academicCycleId,
          })}
      </Modal>
    </div>
  );
}
