import { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import { Button } from '../../../components/ui/button';
import apiClient from '../../../api/client';
import { downloadBoletin } from '../../../hooks/useBoletin';
import { levelLabel } from '../../../constants/levels';

// ── Interfaces ─────────────────────────────────────────────

interface StudentDetail {
  [key: string]: unknown;
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  email: string | null;
  birthDate: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  institutionId: string;
}

/**
 * SDD-2 R17: replaces Enrollment interface. Mirrors StudentMembershipEnriched from backend.
 * Source: GET /students/:studentId/memberships (AlumnosXCursoXCiclo enriched).
 */
interface StudentMembership {
  [key: string]: unknown;
  id: string;
  courseCycleId: string;
  printable: boolean;
  /** CourseCycle.active — el ciclo vigente. */
  active: boolean;
  level: number;
  academicYear: string;
  /** AcademicCycle.name del ciclo lectivo, p.ej. "Secundario 2026". */
  cycleName: string;
  grade: string | null;
  division: string | null;
  createdAt: string;
}

/**
 * Reemplaza la interfaz legacy `Nota`. Espejo (parcial) de SubjectEntry del backend.
 * Source: GET /grading/subject-grades/by-student → { subjects: SubjectEntry[] }.
 * El modelo viejo (Nota/Evaluacion) fue retirado; las notas viven en
 * SubjectPeriodGrade (por período) y SubjectFinalGrade (finales).
 */
interface SubjectGrade {
  [key: string]: unknown;
  subjectId: string;
  subjectName: string;
  periodGrades: Array<{ periodOrdinal: number; gradeCode: string | null }>;
  finalGrades: Array<{ type: string; gradeCode: string | null }>;
}

// ── Helpers ────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('es-AR');
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Membresía más reciente: mayor año lectivo, desempate por fecha de alta. */
function mostRecentMembership(list: StudentMembership[]): StudentMembership | null {
  if (list.length === 0) return null;
  return [...list].sort((a, b) => {
    const byYear = Number(b.academicYear) - Number(a.academicYear);
    if (byYear !== 0) return byYear;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];
}

/**
 * Selección por omisión: el CursoXCiclo activo/vigente (el más reciente si hay varios
 * activos); si ninguno está activo, cae al más reciente del listado.
 */
function defaultMembership(list: StudentMembership[]): StudentMembership | null {
  const actives = list.filter((m) => m.active);
  return mostRecentMembership(actives.length ? actives : list);
}

// ── Component ──────────────────────────────────────────────

interface StudentLegajoProps {
  studentId: string;
  institutionId?: string;
}

export function StudentLegajo({ studentId, institutionId }: StudentLegajoProps) {
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  // SDD-2 R17: memberships replace enrollments (AlumnosXCursoXCiclo enriched rows)
  const [memberships, setMemberships] = useState<StudentMembership[]>([]);
  // Ciclo lectivo seleccionado (id de la membresía / AlumnosXCursoXCiclo).
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);
  const [subjectGrades, setSubjectGrades] = useState<SubjectGrade[]>([]);
  const [loadingLegajo, setLoadingLegajo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!studentId) return;

    setSelectedStudent(null);
    setMemberships([]);
    setSelectedMembershipId(null);
    setSubjectGrades([]);
    setError('');
    setLoadingLegajo(true);

    const tenantParams = institutionId ? { institutionId } : {};

    Promise.allSettled([
      apiClient.get(`/students/${studentId}`, { params: tenantParams }),
      // SDD-2 R17: GET /students/:studentId/memberships replaces GET /enrollments
      apiClient.get(`/students/${studentId}/memberships`),
    ]).then((results) => {
      // Student detail (required)
      if (
        results[0].status === 'rejected' ||
        !(results[0] as { value?: { data?: { data?: StudentDetail } } }).value?.data?.data
      ) {
        setError('Alumno no encontrado');
        setLoadingLegajo(false);
        return;
      }
      setSelectedStudent(
        (results[0] as { value: { data: { data: StudentDetail } } }).value.data.data,
      );

      // Memberships (optional)
      if (results[1].status === 'fulfilled') {
        setMemberships(
          (results[1] as { value?: { data?: { data?: StudentMembership[] } } }).value?.data?.data ?? [],
        );
      } else {
        setMemberships([]);
      }

      setLoadingLegajo(false);
    });
  }, [studentId, institutionId]);

  // Al cargar las membresías, auto-seleccionar el ciclo activo/vigente (fallback: más reciente).
  useEffect(() => {
    setSelectedMembershipId(defaultMembership(memberships)?.id ?? null);
  }, [memberships]);

  // Calificaciones (modelo nuevo): se piden las notas del ciclo SELECCIONADO a
  // GET /grading/subject-grades/by-student. Reemplaza al endpoint legacy /notas.
  // El courseCycleId que el endpoint exige sale de la membresía elegida.
  useEffect(() => {
    const selected = memberships.find((m) => m.id === selectedMembershipId);
    if (!studentId || !selected) {
      setSubjectGrades([]);
      return;
    }

    let cancelled = false;

    apiClient
      .get('/grading/subject-grades/by-student', {
        params: { courseCycleId: selected.courseCycleId, studentId },
      })
      .then(
        (res) =>
          (res as { data?: { data?: { subjects?: SubjectGrade[] } } }).data?.data?.subjects ?? [],
      )
      .catch(() => [] as SubjectGrade[])
      .then((subjects) => {
        if (cancelled) return;
        setSubjectGrades(subjects);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMembershipId, memberships, studentId]);

  if (loadingLegajo) {
    return (
      <Card>
        <p style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>Cargando legajo...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p style={{ color: 'var(--color-danger)', padding: 'var(--space-md)' }}>{error}</p>
      </Card>
    );
  }

  if (!selectedStudent) return null;

  const selectedMembership = memberships.find((m) => m.id === selectedMembershipId) ?? null;

  return (
    <div className="legajo-content">
      {/* ── Datos Personales ── */}
      <Card title="Datos Personales" className="mt-md">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <div>
            <p className="legajo-label">Nombre completo</p>
            <p className="legajo-value">
              {selectedStudent.lastName}, {selectedStudent.firstName}
            </p>
          </div>
          <div>
            <p className="legajo-label">DNI</p>
            <p className="legajo-value">{selectedStudent.dni}</p>
          </div>
          <div>
            <p className="legajo-label">Email</p>
            <p className="legajo-value">{selectedStudent.email || '-'}</p>
          </div>
          <div>
            <p className="legajo-label">Fecha de nacimiento</p>
            <p className="legajo-value">{formatDate(selectedStudent.birthDate)}</p>
          </div>
          <div>
            <p className="legajo-label">Tutor / Responsable</p>
            <p className="legajo-value">{selectedStudent.guardianName || '-'}</p>
          </div>
          <div>
            <p className="legajo-label">Teléfono del tutor</p>
            <p className="legajo-value">{selectedStudent.guardianPhone || '-'}</p>
          </div>
        </div>
      </Card>

      {/* ── Cursos Ciclo (SDD-2: reemplaza Matrículas) ── */}
      <Card title={`Cursos Ciclo (${memberships.length})`} className="mt-md">
        {memberships.length > 0 && (
          <p className="legajo-hint">Hacé clic en un ciclo para ver sus calificaciones.</p>
        )}
        <Table
          columns={[
            {
              key: 'sel',
              header: '',
              render: (m: StudentMembership) => (m.id === selectedMembershipId ? '●' : '○'),
            },
            { key: 'academicYear', header: 'Año lectivo' },
            { key: 'level', header: 'Nivel', render: (m: StudentMembership) => levelLabel(m.level) },
            { key: 'grade', header: 'Grado/Año', render: (m: StudentMembership) => m.grade || '-' },
            {
              key: 'division',
              header: 'División',
              render: (m: StudentMembership) => m.division || '-',
            },
            {
              key: 'printable',
              header: 'Boletín',
              render: (m: StudentMembership) => (m.printable ? '✓ Sí' : '✗ No'),
            },
            {
              key: 'createdAt',
              header: 'Fecha alta',
              render: (m: StudentMembership) => formatDateTime(m.createdAt),
            },
          ]}
          data={memberships}
          onRowClick={(m: StudentMembership) => setSelectedMembershipId(m.id)}
          emptyMessage="Sin cursos asignados"
        />
      </Card>

      {/* ── Calificaciones (por ciclo lectivo) ── */}
      <Card
        title={`Calificaciones (${subjectGrades.length} materias)${subjectGrades.length === 0 ? ' — sin datos disponibles' : ''}`}
        className="mt-md"
      >
        {selectedMembership && (
          <div className="legajo-ciclo-bar">
            <div className="legajo-ciclo-field">
              <span className="legajo-label">Ciclo seleccionado</span>
              <p className="legajo-value">{selectedMembership.cycleName}</p>
            </div>
            <Button
              variant="action"
              size="sm"
              className="legajo-boletin-btn"
              disabled={!selectedMembership.printable}
              title={
                selectedMembership.printable
                  ? 'Imprimir boletín de este ciclo'
                  : 'Este ciclo no tiene boletín imprimible'
              }
              onClick={() => downloadBoletin(selectedMembership.id)}
            >
              📄 Boletín
            </Button>
          </div>
        )}
        {subjectGrades.length === 0 ? (
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-muted)',
              padding: 'var(--space-md)',
            }}
          >
            No hay calificaciones registradas para este alumno.
          </p>
        ) : (
          <Table
            columns={[
              { key: 'subjectName', header: 'Materia' },
              {
                key: 'periodGrades',
                header: 'Notas por período',
                render: (s: SubjectGrade) => {
                  const codes = s.periodGrades
                    .filter((g) => g.gradeCode != null && g.gradeCode !== '')
                    .map((g) => `${g.periodOrdinal}° ${g.gradeCode}`);
                  return codes.length ? codes.join(' · ') : '-';
                },
              },
              {
                key: 'finalGrades',
                header: 'Nota final',
                render: (s: SubjectGrade) => {
                  const codes = s.finalGrades
                    .filter((f) => f.gradeCode != null && f.gradeCode !== '')
                    .map((f) => `${f.type}: ${f.gradeCode}`);
                  return codes.length ? codes.join(' · ') : '-';
                },
              },
            ]}
            data={subjectGrades}
            emptyMessage="Sin calificaciones registradas"
          />
        )}
      </Card>

      <style>{`
        .legajo-label { font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: 0.15rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .legajo-value { font-size: var(--text-base); font-weight: 500; }
        .legajo-hint { font-size: var(--text-sm); color: var(--color-text-muted); margin: 0 0 var(--space-sm); }
        .legajo-ciclo-bar { display: flex; align-items: flex-end; gap: var(--space-md); flex-wrap: wrap; margin-bottom: var(--space-md); }
        .legajo-ciclo-field { display: flex; flex-direction: column; }
        .legajo-boletin-btn { margin-left: auto; }
      `}</style>
    </div>
  );
}
