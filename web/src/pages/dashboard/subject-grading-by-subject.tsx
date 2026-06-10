/**
 * PR5-T6 [GREEN] — SubjectGradingBySubject page ("Alumnos por Materia").
 *
 * Replaces /competency-grading for Primario level.
 *
 * Features:
 * - TeacherFilteredSelector (Primario-only)
 * - Period grades table: grade dropdown + PA/PPI/PP per student×period (inline save)
 * - Final grades table: 4 types (FINAL, DICIEMBRE, MARZO, DEFINITIVA) per student
 * - Competency section: reuses CompetencyGradingGrid
 *
 * Primario filter: Math.floor(level/10) === 2  (levels 20-29)
 * Specs: ES-R1 (CORRECTED), ES-R4, ES-R6, ES-R7, ES-R8, ES-R10, ES-R11
 */
import { useState } from 'react';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { TeacherFilteredSelector } from './components/TeacherFilteredSelector';
import type { TeacherFilteredSelectionContext } from './components/TeacherFilteredSelector';
import { CompetencyGradingGrid } from './components/CompetencyGradingGrid';
import { useGradingGrid } from './components/use-grading-grid';

// ── Constants ──────────────────────────────────────────────────────────────────

const FINAL_TYPES = ['FINAL', 'DICIEMBRE', 'MARZO', 'DEFINITIVA'] as const;

/** Primario: levels 20–29 */
const isPrimario = (cc: { level: number }) => Math.floor(cc.level / 10) === 2;

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

// ── Grading grid inner component ───────────────────────────────────────────────

interface SubjectGradingGridProps {
  context: TeacherFilteredSelectionContext;
}

function SubjectGradingGrid({ context }: SubjectGradingGridProps) {
  const grid = useGradingGrid({
    courseCycleId: context.courseCycleId,
    studyPlanSubjectId: context.studyPlanSubjectId ?? '',
    level: context.level,
    modality: context.modality,
    subjectId: context.subjectId,
  });

  if (grid.loading) {
    return (
      <Card className="mt-lg">
        <div data-testid="grid-loading" style={emptyStyle}>
          Cargando calificaciones...
        </div>
      </Card>
    );
  }

  if (grid.error) {
    return (
      <Card className="mt-lg">
        <div style={errorStyle}>{grid.error}</div>
      </Card>
    );
  }

  if (!context.studyPlanSubjectId) {
    return (
      <Card className="mt-lg">
        <div style={errorStyle}>
          Sin plan de estudios configurado para esta materia.
        </div>
      </Card>
    );
  }

  return (
    <>
      {/* ── Period grades + PA/PPI/PP ────────────────────────────────────────── */}
      <Card className="mt-lg">
        <div data-testid="subject-period-grades-section">
          <p style={sectionTitleStyle}>Notas por Período</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle} role="grid" aria-label="Notas por período">
              <thead>
                <tr>
                  <th style={thStyle}>Alumno</th>
                  {grid.subjectGradePeriods.map(p =>
                    ['Nota', 'PA', 'PPI', 'PP'].map(col => (
                      <th key={`${p.periodOrdinal}-${col}`} style={thStyle}>
                        {col === 'Nota' ? p.periodName : col}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {grid.students.map(student => (
                  <tr key={student.studentId}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>
                      {student.firstName} {student.lastName}
                    </td>
                    {grid.subjectGradePeriods.flatMap(p => {
                      const key = `${student.studentId}:${p.periodOrdinal}`;
                      const cell = grid.subjectPeriodGradeCells.get(key);
                      return [
                        // Grade dropdown
                        <td key={`nota-${key}`} style={tdStyle}>
                          <select
                            style={selectStyle}
                            aria-label={`Nota período ${p.periodOrdinal} - ${student.studentId}`}
                            value={cell?.gradeScaleValueId ?? ''}
                            onChange={e =>
                              grid.updateSubjectPeriodGrade(key, {
                                gradeScaleValueId: e.target.value || null,
                              })
                            }
                          >
                            <option value="">—</option>
                            {grid.scaleValues.map(sv => (
                              <option key={sv.id} value={sv.id}>
                                {sv.code}
                              </option>
                            ))}
                          </select>
                        </td>,
                        // PA checkbox
                        <td key={`pa-${key}`} style={tdStyle}>
                          <input
                            type="checkbox"
                            aria-label="PA"
                            checked={cell?.pa ?? false}
                            onChange={e =>
                              grid.updateSubjectPeriodGrade(key, { pa: e.target.checked })
                            }
                          />
                        </td>,
                        // PPI checkbox
                        <td key={`ppi-${key}`} style={tdStyle}>
                          <input
                            type="checkbox"
                            aria-label="PPI"
                            checked={cell?.ppi ?? false}
                            onChange={e =>
                              grid.updateSubjectPeriodGrade(key, { ppi: e.target.checked })
                            }
                          />
                        </td>,
                        // PP checkbox
                        <td key={`pp-${key}`} style={tdStyle}>
                          <input
                            type="checkbox"
                            aria-label="PP"
                            checked={cell?.pp ?? false}
                            onChange={e =>
                              grid.updateSubjectPeriodGrade(key, { pp: e.target.checked })
                            }
                          />
                        </td>,
                      ];
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* ── Final grades ────────────────────────────────────────────────────── */}
      <Card className="mt-md">
        <div data-testid="subject-final-grades-section">
          <p style={sectionTitleStyle}>Calificaciones Especiales</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle} role="grid" aria-label="Calificaciones finales">
              <thead>
                <tr>
                  <th style={thStyle}>Alumno</th>
                  {FINAL_TYPES.map(type => (
                    <th key={type} style={thStyle}>{type}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.students.map(student => (
                  <tr key={student.studentId}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>
                      {student.firstName} {student.lastName}
                    </td>
                    {FINAL_TYPES.map(type => {
                      const key = `${student.studentId}:${type}`;
                      const cell = grid.subjectFinalGradeCells.get(key);
                      return (
                        <td key={type} style={tdStyle}>
                          <select
                            style={selectStyle}
                            aria-label={`Nota final ${type} - ${student.studentId}`}
                            value={cell?.gradeScaleValueId ?? ''}
                            onChange={e =>
                              grid.updateSubjectFinalGrade(key, {
                                gradeScaleValueId: e.target.value || undefined,
                              })
                            }
                          >
                            <option value="">—</option>
                            {grid.scaleValues.map(sv => (
                              <option key={sv.id} value={sv.id}>
                                {sv.code}
                              </option>
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
        </div>
      </Card>

      {/* ── Competency section — reuses CompetencyGradingGrid ───────────────── */}
      <CompetencyGradingGrid
        courseCycleId={context.courseCycleId}
        studyPlanId=""
        studyPlanSubjectId={context.studyPlanSubjectId}
        level={context.level}
        modality={context.modality}
      />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubjectGradingBySubjectPage() {
  const [context, setContext] = useState<TeacherFilteredSelectionContext | null>(null);

  return (
    <div>
      <PremiumHeader
        title="Alumnos por Materia"
        subtitle="Seleccioná el ciclo de curso y la materia para calificar"
        icon="📝"
      />

      {/* Teacher-filtered selector — Primario CCs only */}
      <Card className="mt-md">
        <TeacherFilteredSelector onSelect={setContext} filterCourseCycle={isPrimario} />
      </Card>

      {/* Grid or placeholder */}
      {context ? (
        <div data-testid="grading-grid-slot" style={{ marginTop: 'var(--space-lg)' }}>
          <SubjectGradingGrid context={context} />
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
            Seleccioná un ciclo de curso y materia para comenzar a calificar.
          </p>
        </Card>
      )}
    </div>
  );
}
