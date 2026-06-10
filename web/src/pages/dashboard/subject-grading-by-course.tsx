/**
 * PR6-T2 [GREEN] — SubjectGradingByCourse page ("Alumnos por Curso").
 *
 * Shows all subjects + grades for a selected (homeroom CC, student) pair.
 *
 * Features:
 * - TeacherFilteredSelector in homeroom mode (Primario-only) → emits CC
 * - Student picker fetched from /course-cycles/:id/students
 * - Per-subject sections: period grades + PA/PPI/PP + 4 finals + competency valuations
 *   with per-cell "Imprimir" toggle (PATCH /competency-valuations/:uuid/periods/:pid)
 * - Inline save (no full reload)
 *
 * W1-avoidance: useStudentGrades called ONCE per selection (not per subject).
 * CompetencyGradingGrid is intentionally NOT used here:
 *   - CGG is students×subject view; by-course is subject×student view
 *   - Rendering N CGG instances for N subjects = N×5 redundant fetches (W1 multiplied)
 *   - competencyValuations come directly from the by-student endpoint response
 *
 * Primario filter: Math.floor(level/10) === 2 (levels 20-29)
 * Specs: ES-R2 (CORRECTED), ES-R5, ES-R6, ES-R7, ES-R8, ES-R10, TIA-R9
 */
import { useState, useEffect } from 'react';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import apiClient from '../../api/client';
import { TeacherFilteredSelector } from './components/TeacherFilteredSelector';
import type { CourseCycleContext } from './components/TeacherFilteredSelector';
import { useStudentGrades } from './components/use-student-grades';
import type { SubjectWithState } from './components/use-student-grades';
import type { ScaleValue } from './components/use-grading-grid';

// ── Constants ──────────────────────────────────────────────────────────────────

const FINAL_TYPES = ['FINAL', 'DICIEMBRE', 'MARZO', 'DEFINITIVA'] as const;

/** Primario: levels 20–29 */
const isPrimario = (cc: { level: number }) => Math.floor(cc.level / 10) === 2;

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

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  marginBottom: '0.25rem',
  display: 'block',
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
}

function StudentGradingGrid({ courseCycleId, studentId, level, modality }: StudentGradingGridProps) {
  const { loading, error, subjects, scaleValues, updatePeriodGrade, updateFinalGrade, updateImprimible } =
    useStudentGrades({ courseCycleId, studentId, level, modality });

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubjectGradingByCoursePage() {
  const [ccContext, setCCContext] = useState<CourseCycleContext | null>(null);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // ── Fetch students when CC is selected ────────────────────────────────────
  useEffect(() => {
    if (!ccContext) return;
    setStudentsLoading(true);
    setStudents([]);
    setSelectedStudentId('');

    apiClient
      .get(`/course-cycles/${ccContext.courseCycleId}/students`)
      .then((r) => setStudents((r.data as { data?: EnrolledStudent[] })?.data ?? []))
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false));
  }, [ccContext]);

  const handleCCSelect = (cc: CourseCycleContext) => {
    setCCContext(cc);
    setSelectedStudentId('');
  };

  return (
    <div>
      <PremiumHeader
        title="Alumnos por Curso"
        subtitle="Seleccioná tu curso a cargo y un alumno para ver sus calificaciones"
        icon="📋"
      />

      {/* Homeroom CC selector — Primario only */}
      <Card className="mt-md">
        <TeacherFilteredSelector
          role="homeroom"
          onSelectCC={handleCCSelect}
          filterCourseCycle={isPrimario}
        />
      </Card>

      {/* Student picker — shown only when CC is selected */}
      {ccContext && (
        <Card className="mt-md">
          <label htmlFor="student-picker" style={labelStyle}>
            Alumno
          </label>
          <select
            id="student-picker"
            aria-label="Alumno"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            disabled={studentsLoading}
            style={{ ...selectStyle, width: '100%', maxWidth: '20rem' }}
          >
            <option value="">
              {studentsLoading ? 'Cargando alumnos...' : 'Seleccionar alumno...'}
            </option>
            {students.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </select>
        </Card>
      )}

      {/* Grading grid or placeholder */}
      {ccContext && selectedStudentId ? (
        <div data-testid="grading-grid-slot" style={{ marginTop: 'var(--space-lg)' }}>
          <StudentGradingGrid
            courseCycleId={ccContext.courseCycleId}
            studentId={selectedStudentId}
            level={ccContext.level}
            modality={ccContext.modality}
          />
        </div>
      ) : (
        <Card className="mt-lg">
          <p
            data-testid="grading-placeholder"
            style={{
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
              padding: 'var(--space-lg)',
            }}
          >
            Seleccioná un ciclo de curso y un alumno para ver sus calificaciones.
          </p>
        </Card>
      )}
    </div>
  );
}
