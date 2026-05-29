import { useState, useEffect } from 'react';
import PremiumPrintReport, { type PrintBranding } from './PremiumPrintReport';

interface CourseData {
  name: string;
  grade: string | null;
  division: string | null;
  subjects: { name: string; hoursPerWeek: number | null }[];
}

interface Props {
  branding: PrintBranding;
  planName: string;
  planLevel: string;
  planModality: string;
  planYear: string;
  courses: CourseData[];
  onClose?: () => void;
  /** Si es true, ya tiene los datos cargados y no necesita fetch */
  ready?: boolean;
}

const LEVEL_LABELS: Record<string, string> = {
  '1': 'Inicial', '2': 'Primario', '3': 'Secundario', '4': 'Terciario', '9': 'Administración',
};

const MODALITY_LABELS: Record<string, string> = {
  '0': 'Común', '1': 'Adultos', '2': 'Especial', '9': 'Todas',
};

export default function StudyPlanDetailPrintView({
  branding, planName, planLevel, planModality, planYear,
  courses, onClose,
}: Props) {
  const totalSubjects = courses.reduce((sum, c) => sum + c.subjects.length, 0);

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
          display: 'table', width: '100%', marginBottom: '1rem',
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
            <div style={{ display: 'table-cell', padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}>{courses.length} cursos · {totalSubjects} materias</div>
          </div>
        </div>

        {/* ── Cursos y materias (identados) ── */}
        {courses.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.85rem' }}>
            Este plan no tiene cursos cargados.
          </p>
        ) : (
          <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
            {courses.map((course, ci) => (
              <div key={ci} style={{ marginBottom: '0.75rem' }}>
                {/* Curso (evitar que el header quede huérfano) */}
                <div style={{
                  padding: '0.55rem 0.75rem',
                  background: branding.bodyColor ?? '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontWeight: 650,
                  fontSize: '0.85rem',
                  color: branding.bodyTextColor ?? '#1e293b',
                  marginBottom: course.subjects.length > 0 ? '0.25rem' : '0',
                  pageBreakInside: 'avoid',
                }}>
                  📘 {course.name}
                  {(course.grade || course.division) && (
                    <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>
                      {[course.grade, course.division].filter(Boolean).join(' ')}
                    </span>
                  )}
                  <span style={{ float: 'right', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>
                    {course.subjects.length} {course.subjects.length === 1 ? 'materia' : 'materias'}
                  </span>
                </div>

                {/* Materias identadas */}
                {course.subjects.map((subj, si) => (
                  <div key={si} style={{
                    padding: '0.4rem 0.75rem 0.4rem 2.5rem',
                    fontSize: '0.78rem',
                    color: branding.bodyTextColor ?? '#334155',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'table', width: '100%', boxSizing: 'border-box',
                    pageBreakInside: 'avoid',
                  }}>
                    <span style={{ display: 'table-cell' }}>
                      <span style={{ color: '#94a3b8', marginRight: '0.3rem' }}>└</span>
                      {subj.name}
                    </span>
                    {subj.hoursPerWeek != null && (
                      <span style={{ display: 'table-cell', textAlign: 'right', fontSize: '0.7rem', color: '#94a3b8', width: '80px' }}>
                        {subj.hoursPerWeek} h/sem
                      </span>
                    )}
                  </div>
                ))}

                {course.subjects.length === 0 && (
                  <div style={{
                    padding: '0.3rem 0.75rem 0.3rem 2.5rem',
                    fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic',
                  }}>
                    Sin materias cargadas
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

/** Componente wrapper que hace fetch de cursos y materias al abrirse */
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

  // Fetch courses + subjects on mount
  useEffect(() => {
    (async () => {
      try {
        const { default: apiClient } = await import('../../api/client');
        // Fetch courses
        const coursesRes = await apiClient.get(`/study-plans/${planId}/courses`);
        const rawCourses = coursesRes.data?.data ?? [];

        const enriched: CourseData[] = [];
        for (const pc of rawCourses) {
          // Fetch subjects for each course
          let subjects: { name: string; hoursPerWeek: number | null }[] = [];
          try {
            const subjRes = await apiClient.get(`/study-plan-courses/${pc.id}/subjects`);
            subjects = (subjRes.data?.data ?? []).map((s: any) => ({
              name: s.subjectName ?? s.subjectId ?? '—',
              hoursPerWeek: s.hoursPerWeek ?? null,
            }));
          } catch { /* ignore */ }

          enriched.push({
            name: pc.courseSectionName ?? pc.courseSectionId ?? `Curso ${pc.id}`,
            grade: pc.courseGrade ?? null,
            division: pc.courseDivision ?? null,
            subjects,
          });
        }
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
