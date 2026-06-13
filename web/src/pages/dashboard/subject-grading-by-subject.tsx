/**
 * PR5-T8 [GREEN] — SubjectGradingBySubject page ("Alumnos por Materia").
 *
 * Generalized for Primario + Secundario (was Primario-only in PR5-T6).
 *
 * Features:
 * - TeacherFilteredSelector (Primario + Secundario CCs)
 * - Period grades table: grade dropdown + PA/PPI/PP per student×period (inline save)
 * - Final grades table: 4 types + Condición select on FINAL row (Secundario)
 * - Competency section: reuses CompetencyGradingGrid
 *
 * Filter: Math.floor(level/10) ∈ {2, 3}  (levels 20-39 — Primario + Secundario)
 * Specs: ESS-R1, ESS-R2, ESS-R5, ESS-R6, C-R3, D3
 */
import { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/auth-context';
import { isManagementUser } from '../../types/materia-grupo';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { TeacherFilteredSelector } from './components/TeacherFilteredSelector';
import type { TeacherFilteredSelectionContext } from './components/TeacherFilteredSelector';
import { CompetencyGradingGrid } from './components/CompetencyGradingGrid';
import { useGradingGrid } from './components/use-grading-grid';

// ── Constants ──────────────────────────────────────────────────────────────────

const FINAL_TYPES = ['FINAL', 'DICIEMBRE', 'MARZO', 'DEFINITIVA'] as const;

/** All student levels: Inicial(1x), Primario(2x), Secundario(3x), Terciario(4x) — excludes admin(9x) */
const isStudentLevel = (cc: { level: number }) =>
  [1, 2, 3, 4].includes(Math.floor(cc.level / 10));

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

// ── Grupo types ────────────────────────────────────────────────────────────────

interface GrupoItem {
  id: string;
  name: string | null;
  docenteName: string | null;
}

// ── Grading grid inner component ───────────────────────────────────────────────

interface SubjectGradingGridProps {
  context: TeacherFilteredSelectionContext;
  /** null = show all students; Set<studentId> = show only those students. */
  allowedStudentIds: Set<string> | null;
}

function SubjectGradingGrid({ context, allowedStudentIds }: SubjectGradingGridProps) {
  const grid = useGradingGrid({
    courseCycleId: context.courseCycleId,
    studyPlanSubjectId: context.studyPlanSubjectId ?? '',
    level: context.level,
    modality: context.modality,
    subjectId: context.subjectId,
    institutionId: context.institutionId,
  });

  // Client-side grupo filter: null = show all, Set = show only those studentIds
  const visibleStudents = allowedStudentIds === null
    ? grid.students
    : grid.students.filter(s => allowedStudentIds.has(s.studentId));

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
                {visibleStudents.map(student => (
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
                                {sv.label}
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
                {visibleStudents.map(student => (
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
                                {sv.label}
                              </option>
                            ))}
                          </select>
                          {/* Condición select — only on FINAL row (ESS-R5, C-R3) */}
                          {type === 'FINAL' && (
                            <select
                              style={{ ...selectStyle, marginTop: '0.25rem' }}
                              aria-label="Condición"
                              value={cell?.condicion ?? ''}
                              onChange={e =>
                                grid.updateSubjectFinalGrade(key, {
                                  condicion: e.target.value || undefined,
                                })
                              }
                            >
                              <option value="">Sin condición</option>
                              <option value="REGULAR">REGULAR</option>
                              <option value="PREVIA">PREVIA</option>
                              <option value="LIBRE">LIBRE</option>
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
        </div>
      </Card>

      {/* ── Competency section — reuses CompetencyGradingGrid ───────────────── */}
      {/* Pass the hook instance already fetched by this component so CGG does  */}
      {/* not trigger a second round of identical fetches (W1 fix).             */}
      <CompetencyGradingGrid
        courseCycleId={context.courseCycleId}
        studyPlanId=""
        studyPlanSubjectId={context.studyPlanSubjectId}
        level={context.level}
        modality={context.modality}
        injectedGrid={grid}
        institutionId={context.institutionId}
      />
    </>
  );
}

// ── Grupo selector styles ──────────────────────────────────────────────────────

const grupoLabelStyle: React.CSSProperties = {
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  marginBottom: '0.25rem',
  display: 'block',
};

const grupoSelectStyle: React.CSSProperties = {
  padding: '0.5rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
  fontSize: 'var(--text-sm)',
  width: '100%',
  maxWidth: '300px',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubjectGradingBySubjectPage() {
  const { user } = useAuth();
  const isManagement = isManagementUser(user?.roles);

  const [context, setContext] = useState<TeacherFilteredSelectionContext | null>(null);

  // ── Grupo state ───────────────────────────────────────────────────────────
  const [grupos, setGrupos] = useState<GrupoItem[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [selectedGrupoId, setSelectedGrupoId] = useState('');
  const [allowedStudentIds, setAllowedStudentIds] = useState<Set<string> | null>(null);

  // ── Resolve materiaId → fetch grupos on context change ────────────────────
  useEffect(() => {
    if (!context) {
      setGrupos([]);
      setSelectedGrupoId('');
      setAllowedStudentIds(null);
      return;
    }

    let cancelled = false;
    setLoadingGrupos(true);
    setGrupos([]);
    setSelectedGrupoId('');
    setAllowedStudentIds(null);

    const tenantParams = context.institutionId ? { institutionId: context.institutionId } : {};

    async function fetchGrupos() {
      try {
        // Step 1: resolve MateriaXCursoXCiclo.id from /materias endpoint
        const materiasRes = await apiClient.get(
          `/course-cycles/${context!.courseCycleId}/materias`,
          { params: tenantParams },
        );
        const materias: Array<{ id: string; subjectId: string }> =
          materiasRes.data?.data ?? [];
        const materia = materias.find(m => m.subjectId === context!.subjectId);

        if (cancelled || !materia) return;

        // Step 2: fetch grupos (endpoint filters by role on the backend)
        const gruposRes = await apiClient.get(
          `/course-cycles/${context!.courseCycleId}/materias/${materia.id}/grupos`,
          { params: tenantParams },
        );

        if (cancelled) return;

        const gruposData: GrupoItem[] = gruposRes.data?.data ?? [];
        setGrupos(gruposData);

        // Docente with exactly one grupo → auto-select it
        if (!isManagement && gruposData.length === 1) {
          setSelectedGrupoId(gruposData[0].id);
        }
      } catch {
        if (!cancelled) setGrupos([]);
      } finally {
        if (!cancelled) setLoadingGrupos(false);
      }
    }

    fetchGrupos();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.courseCycleId, context?.subjectId, context?.institutionId, isManagement]);

  // ── Fetch grupo alumnos → build allowedStudentIds filter ──────────────────
  useEffect(() => {
    if (!selectedGrupoId) {
      setAllowedStudentIds(null);
      return;
    }

    const tenantParams = context?.institutionId ? { institutionId: context.institutionId } : {};

    apiClient
      .get(`/grupos/${selectedGrupoId}/alumnos`, { params: tenantParams })
      .then(r => {
        const alumnos: Array<{ id: string; studentId: string; studentName: string }> =
          r.data?.data ?? r.data ?? [];
        setAllowedStudentIds(new Set(alumnos.map(a => a.studentId)));
      })
      .catch(() => {
        setAllowedStudentIds(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrupoId, context?.institutionId]);

  return (
    <div>
      <PremiumHeader
        title="Alumnos por Materia"
        subtitle="Seleccioná el ciclo de curso y la materia para calificar"
        icon="📝"
      />

      {/* Teacher-filtered selector — Primario + Secundario CCs */}
      <Card className="mt-md">
        <TeacherFilteredSelector onSelect={setContext} filterCourseCycle={isStudentLevel} />

        {/* Grupo selector — shown after materia is selected and grupos are loaded */}
        {context && !loadingGrupos && grupos.length > 0 && (
          <div
            data-testid="sbs-grupo-filter"
            style={{
              marginTop: 'var(--space-md)',
              paddingTop: 'var(--space-md)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <label htmlFor="sbs-grupo-select" style={grupoLabelStyle}>Grupo</label>
            <select
              id="sbs-grupo-select"
              aria-label="Grupo"
              data-testid="sbs-grupo-select"
              value={selectedGrupoId}
              onChange={e => setSelectedGrupoId(e.target.value)}
              style={grupoSelectStyle}
            >
              {/* Management roles: "Todos" shows all students (no filter) */}
              {isManagement && <option value="">Todos</option>}
              {grupos.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name ?? g.docenteName ?? `Grupo ${g.id.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      {/* Grid or placeholder */}
      {context ? (
        <div data-testid="grading-grid-slot" style={{ marginTop: 'var(--space-lg)' }}>
          <SubjectGradingGrid context={context} allowedStudentIds={allowedStudentIds} />
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
