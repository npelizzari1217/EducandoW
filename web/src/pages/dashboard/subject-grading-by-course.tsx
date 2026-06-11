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
import type { SubjectWithState } from './components/use-student-grades';
import type { ScaleValue } from './components/use-grading-grid';
import { StudentLegajo } from './components/StudentLegajo';
import { StudentObservationsPanel } from './components/StudentObservationsPanel';

// ── Constants ──────────────────────────────────────────────────────────────────

const FINAL_TYPES = ['FINAL', 'DICIEMBRE', 'MARZO', 'DEFINITIVA'] as const;

/** Primario + Secundario: levels 20–29 (Primario) and 30–39 (Secundario) */
const isPrimarioOrSecundario = (cc: { level: number }) =>
  [2, 3].includes(Math.floor(cc.level / 10));

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

const subSectionTitleStyle: React.CSSProperties = {
  fontWeight: 500,
  fontSize: 'var(--text-sm)',
  marginBottom: 'var(--space-xs)',
  color: 'var(--color-text-secondary)',
  marginTop: 'var(--space-md)',
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
  const { loading, error, subjects, scaleValues, updatePeriodGrade, updateFinalGrade, updateImprimible } =
    useStudentGrades({ courseCycleId, studentId, level, modality, institutionId });

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

  return (
    <>
      {subjects.map((subject) => (
        <SubjectSection
          key={subject.subjectId}
          subject={subject}
          scaleValues={scaleValues}
          onUpdatePeriodGrade={updatePeriodGrade}
          onUpdateFinalGrade={updateFinalGrade}
          onUpdateImprimible={updateImprimible}
        />
      ))}
    </>
  );
}

// ── Inner: SubjectSection ──────────────────────────────────────────────────────

interface SubjectSectionProps {
  subject: SubjectWithState;
  scaleValues: ScaleValue[];
  onUpdatePeriodGrade(subjectId: string, periodOrdinal: number, updates: object): void;
  onUpdateFinalGrade(subjectId: string, type: string, updates: object): void;
  onUpdateImprimible(valuationId: string, periodItemId: string, imprimible: boolean): void;
}

function SubjectSection({
  subject,
  scaleValues,
  onUpdatePeriodGrade,
  onUpdateFinalGrade,
  onUpdateImprimible,
}: SubjectSectionProps) {
  return (
    <Card className="mt-md">
      {/* Subject name heading */}
      <p style={sectionTitleStyle}>{subject.subjectName}</p>

      {/* ── Period grades + PA/PPI/PP ──────────────────────────────────────── */}
      <div data-testid="student-period-grades-section">
        <p style={subSectionTitleStyle}>Notas por Período</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle} role="grid" aria-label={`Notas por período — ${subject.subjectName}`}>
            <thead>
              <tr>
                <th style={thStyle}>Período</th>
                <th style={thStyle}>Nota</th>
                <th style={thStyle}>PA</th>
                <th style={thStyle}>PPI</th>
                <th style={thStyle}>PP</th>
              </tr>
            </thead>
            <tbody>
              {subject.periods.map((period) => {
                const grade = subject.periodGrades.find(
                  (g) => g.periodOrdinal === period.periodOrdinal,
                );
                return (
                  <tr key={period.periodOrdinal}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{period.periodName}</td>

                    {/* Grade dropdown */}
                    <td style={tdStyle}>
                      <select
                        style={selectStyle}
                        aria-label={`Nota período ${period.periodOrdinal} - ${subject.subjectId}`}
                        value={grade?.gradeScaleValueId ?? ''}
                        onChange={(e) =>
                          onUpdatePeriodGrade(subject.subjectId, period.periodOrdinal, {
                            gradeScaleValueId: e.target.value || null,
                          })
                        }
                      >
                        <option value="">—</option>
                        {scaleValues.map((sv) => (
                          <option key={sv.id} value={sv.id}>
                            {sv.code}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* PA */}
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        aria-label="PA"
                        checked={grade?.pa ?? false}
                        onChange={(e) =>
                          onUpdatePeriodGrade(subject.subjectId, period.periodOrdinal, {
                            pa: e.target.checked,
                          })
                        }
                      />
                    </td>

                    {/* PPI */}
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        aria-label="PPI"
                        checked={grade?.ppi ?? false}
                        onChange={(e) =>
                          onUpdatePeriodGrade(subject.subjectId, period.periodOrdinal, {
                            ppi: e.target.checked,
                          })
                        }
                      />
                    </td>

                    {/* PP */}
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        aria-label="PP"
                        checked={grade?.pp ?? false}
                        onChange={(e) =>
                          onUpdatePeriodGrade(subject.subjectId, period.periodOrdinal, {
                            pp: e.target.checked,
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Final grades ──────────────────────────────────────────────────── */}
      <div data-testid="student-final-grades-section">
        <p style={subSectionTitleStyle}>Calificaciones Especiales</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle} role="grid" aria-label={`Calificaciones finales — ${subject.subjectName}`}>
            <thead>
              <tr>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Nota</th>
              </tr>
            </thead>
            <tbody>
              {FINAL_TYPES.map((type) => {
                const fg = subject.finalGrades.find((f) => f.type === type);
                return (
                  <tr key={type}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{type}</td>
                    <td style={tdStyle}>
                      <select
                        style={selectStyle}
                        aria-label={`Nota final ${type} - ${subject.subjectId}`}
                        value={fg?.gradeScaleValueId ?? ''}
                        onChange={(e) =>
                          onUpdateFinalGrade(subject.subjectId, type, {
                            gradeScaleValueId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">—</option>
                        {scaleValues.map((sv) => (
                          <option key={sv.id} value={sv.id}>
                            {sv.code}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Competency valuations with "Imprimir" toggle ───────────────────── */}
      {subject.competencyValuations.length > 0 && (
        <div data-testid="competency-section">
          <p style={subSectionTitleStyle}>Competencias</p>
          {subject.competencyValuations.map((cv) => (
            <div
              key={cv.valuationId}
              style={{
                borderBottom: '1px solid var(--color-border)',
                padding: '0.35rem 0',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-md)',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-secondary)',
                  minWidth: '8rem',
                  fontWeight: 500,
                }}
              >
                {cv.competencyName}
              </span>

              {cv.periodValuations.map((pv) => (
                <label
                  key={pv.periodItemId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pv.imprimible}
                    aria-label={`Imprimir ${cv.valuationId}:${pv.periodItemId}`}
                    onChange={(e) =>
                      onUpdateImprimible(cv.valuationId, pv.periodItemId, e.target.checked)
                    }
                  />
                  Imprimir
                </label>
              ))}
            </div>
          ))}
        </div>
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
    key: 'observations',
    label: 'Observaciones',
    render: (s, ctx) => (
      <StudentObservationsPanel
        studentId={s.studentId}
        institutionId={ctx.institutionId}
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
          filterCourseCycle={isPrimarioOrSecundario}
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
          })}
      </Modal>
    </div>
  );
}
