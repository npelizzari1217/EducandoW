import { useState, useEffect } from 'react';
import PremiumPrintReport, { type PrintBranding } from './PremiumPrintReport';
import apiClient from '../../api/client';

// ── Types ──────────────────────────────────────────────────────────────────

interface SubjectData {
  /** studyPlanSubjectId — junction-table PK used to fetch competencies */
  id: string;
  name: string;
  hoursPerWeek: number | null;
  /** Names of the competencies for this subject */
  competencies: string[];
}

interface CourseData {
  name: string;
  grade: string | null;
  division: string | null;
  subjects: SubjectData[];
}

interface Props {
  branding: PrintBranding;
  planName: string;
  planLevel: string;
  planModality: string;
  planYear: string;
  courses: CourseData[];
  onClose?: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  '1': 'Inicial', '2': 'Primario', '3': 'Secundario', '4': 'Terciario', '9': 'Administración',
};

const MODALITY_LABELS: Record<string, string> = {
  '0': 'Común', '1': 'Adultos', '2': 'Especial', '9': 'Todas',
};

// ── Print view ─────────────────────────────────────────────────────────────

export default function StudyPlanDetailPrintView({
  branding, planName, planLevel, planModality, planYear,
  courses, onClose,
}: Props) {
  const totalSubjects = courses.reduce((sum, c) => sum + c.subjects.length, 0);
  const totalCompetencies = courses.reduce(
    (sum, c) => sum + c.subjects.reduce((s2, subj) => s2 + subj.competencies.length, 0),
    0,
  );

  return (
    <div style={{ position: 'relative' }}>
      {onClose && (
        <div className="ppr-no-print" style={{
          maxWidth: '210mm', margin: '0 auto 0.5rem auto',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0',
              background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem',
            }}
          >
            ← Volver
          </button>
        </div>
      )}

      <PremiumPrintReport
        branding={branding}
        systemSubtitle="Sistema de Gestión Pedagógica y Administrativa"
        reportTitle={`Plan de Estudio: ${planName}`}
        footerLegalText="Documento oficial del sistema EducandoW. Los planes de estudio aquí detallados están aprobados por la autoridad educativa competente. Toda modificación debe ser registrada y auditada."
      >
        {/* ── Resumen del plan ── */}
        <div style={{
          display: 'table', width: '100%', marginBottom: '1.25rem',
          border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{ display: 'table-row', background: '#f8fafc' }}>
            <div style={{ display: 'table-cell', padding: '0.5rem 0.75rem', fontWeight: 600, fontSize: '0.78rem', color: '#475569', width: '25%' }}>Nivel</div>
            <div style={{ display: 'table-cell', padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}>{LEVEL_LABELS[planLevel] ?? planLevel}</div>
            <div style={{ display: 'table-cell', padding: '0.5rem 0.75rem', fontWeight: 600, fontSize: '0.78rem', color: '#475569', width: '25%' }}>Modalidad</div>
            <div style={{ display: 'table-cell', padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}>{MODALITY_LABELS[planModality] ?? planModality}</div>
          </div>
          <div style={{ display: 'table-row' }}>
            <div style={{ display: 'table-cell', padding: '0.5rem 0.75rem', fontWeight: 600, fontSize: '0.78rem', color: '#475569' }}>Año lectivo</div>
            <div style={{ display: 'table-cell', padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}>{planYear}</div>
            <div style={{ display: 'table-cell', padding: '0.5rem 0.75rem', fontWeight: 600, fontSize: '0.78rem', color: '#475569' }}>Totales</div>
            <div style={{ display: 'table-cell', padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}>
              {courses.length} {courses.length === 1 ? 'curso' : 'cursos'} · {totalSubjects} {totalSubjects === 1 ? 'materia' : 'materias'} · {totalCompetencies} {totalCompetencies === 1 ? 'competencia' : 'competencias'}
            </div>
          </div>
        </div>

        {/* ── Cursos → Materias → Competencias ── */}
        {courses.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.85rem' }}>
            Este plan no tiene cursos cargados.
          </p>
        ) : (
          <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
            {courses.map((course, ci) => (
              <div key={ci} style={{ marginBottom: '1.25rem' }}>

                {/* ── CORTE DE CONTROL NIVEL 1: CURSO ── */}
                <div style={{
                  padding: '0.55rem 0.85rem',
                  background: branding.headerColor ?? '#1e293b',
                  color: branding.headerTextColor ?? '#ffffff',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  pageBreakAfter: 'avoid',
                  breakAfter: 'avoid',
                }}>
                  <span>
                    {course.name}
                    {(course.grade || course.division) && (
                      <span style={{ fontWeight: 400, fontSize: '0.76rem', opacity: 0.8, marginLeft: '0.5rem' }}>
                        {[course.grade, course.division].filter(Boolean).join(' ')}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 400, opacity: 0.75 }}>
                    {course.subjects.length} {course.subjects.length === 1 ? 'materia' : 'materias'}
                  </span>
                </div>

                {/* Materias del curso */}
                {course.subjects.length === 0 ? (
                  <div style={{
                    padding: '0.4rem 0.85rem 0.4rem 1.5rem',
                    fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic',
                    borderLeft: '3px solid #e2e8f0', marginTop: '0.25rem',
                  }}>
                    Sin materias cargadas
                  </div>
                ) : (
                  <div style={{ marginTop: '0.25rem', borderLeft: '3px solid #e2e8f0', marginLeft: '0.5rem' }}>
                    {course.subjects.map((subj, si) => (
                      <div
                        key={si}
                        style={{
                          marginBottom: si < course.subjects.length - 1 ? '0.4rem' : 0,
                          pageBreakInside: 'avoid',
                          breakInside: 'avoid',
                        }}
                      >
                        {/* ── CORTE DE CONTROL NIVEL 2: MATERIA ── */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.42rem 0.75rem 0.42rem 1rem',
                          background: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          color: branding.bodyTextColor ?? '#1e293b',
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>▸</span>
                            {subj.name}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 400 }}>
                            {subj.competencies.length > 0 && (
                              <span>{subj.competencies.length} {subj.competencies.length === 1 ? 'competencia' : 'competencias'}</span>
                            )}
                            {subj.hoursPerWeek != null && (
                              <span>{subj.hoursPerWeek} h/sem</span>
                            )}
                          </span>
                        </div>

                        {/* Competencias de la materia */}
                        {subj.competencies.length === 0 ? (
                          <div style={{
                            padding: '0.3rem 0.75rem 0.3rem 2.5rem',
                            fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic',
                          }}>
                            Sin competencias
                          </div>
                        ) : (
                          <div style={{ padding: '0.3rem 0.75rem 0.3rem 2rem' }}>
                            {subj.competencies.map((comp, pi) => (
                              <div
                                key={pi}
                                style={{
                                  fontSize: '0.76rem',
                                  color: branding.bodyTextColor ?? '#334155',
                                  padding: '0.18rem 0',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '0.4rem',
                                  lineHeight: 1.4,
                                }}
                              >
                                <span style={{ color: '#94a3b8', flexShrink: 0, marginTop: '0.05rem' }}>•</span>
                                <span>{comp}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </PremiumPrintReport>
    </div>
  );
}

// ── Loader ─────────────────────────────────────────────────────────────────
// Fetches courses → subjects → competencies on mount, then renders the view.

export function StudyPlanDetailPrintLoader({
  branding,
  planId,
  planName,
  planLevel,
  planModality,
  planYear,
  onClose,
}: {
  branding: PrintBranding;
  planId: string;
  planName: string;
  planLevel: string;
  planModality: string;
  planYear: string;
  onClose?: () => void;
}) {
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // 1. Fetch all courses for the plan
        const coursesRes = await apiClient.get(`/study-plans/${planId}/courses`);
        const rawCourses: Array<Record<string, unknown>> = coursesRes.data?.data ?? [];

        // 2. Fetch subjects + competencies for each course (courses sequentially, subjects+competencies in parallel)
        const enriched: CourseData[] = await Promise.all(
          rawCourses.map(async (pc) => {
            let subjects: SubjectData[] = [];

            try {
              const subjRes = await apiClient.get(`/study-plan-courses/${pc.id as string}/subjects`);
              const rawSubjects: Array<Record<string, unknown>> = subjRes.data?.data ?? [];

              // Fetch competencies for each subject in parallel
              subjects = await Promise.all(
                rawSubjects.map(async (s) => {
                  const studyPlanSubjectId = s.id as string;
                  let competencies: string[] = [];

                  try {
                    const compRes = await apiClient.get('/subject-competencies', {
                      params: { studyPlanSubjectId },
                    });
                    competencies = (compRes.data?.data ?? []).map(
                      (c: Record<string, unknown>) => (c.name ?? '') as string,
                    );
                  } catch { /* ignore — show empty competencies */ }

                  return {
                    id: studyPlanSubjectId,
                    name: (s.subjectName ?? s.subjectId ?? '—') as string,
                    hoursPerWeek: (s.hoursPerWeek ?? null) as number | null,
                    competencies,
                  };
                }),
              );
            } catch { /* ignore — show course with no subjects */ }

            return {
              name: (pc.courseSectionName ?? pc.courseSectionId ?? `Curso ${pc.id as string}`) as string,
              grade: (pc.courseGrade ?? null) as string | null,
              division: (pc.courseDivision ?? null) as string | null,
              subjects,
            };
          }),
        );

        setCourses(enriched);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [planId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontSize: '1rem' }}>
        ⏳ Cargando plan de estudio...
      </div>
    );
  }

  return (
    <StudyPlanDetailPrintView
      branding={branding}
      planName={planName}
      planLevel={planLevel}
      planModality={planModality}
      planYear={planYear}
      courses={courses}
      onClose={onClose}
    />
  );
}
