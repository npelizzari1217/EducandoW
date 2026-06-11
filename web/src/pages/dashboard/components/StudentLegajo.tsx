import { useState, useEffect } from 'react';
import { Card } from '../../../components/ui/card';
import { Table } from '../../../components/ui/table';
import apiClient from '../../../api/client';

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

interface Enrollment {
  [key: string]: unknown;
  id: string;
  studentId: string;
  institutionId: string;
  level: string;
  academicYear: string;
  grade: string | null;
  division: string | null;
  status: string;
  enrolledAt: string;
}

interface Nota {
  [key: string]: unknown;
  id: string;
  evaluationId: string;
  numericValue: number | null;
  qualitativeValue: string | null;
  gradeCode: string | null;
  gradeLabel: string | null;
}

interface AttendanceRecord {
  [key: string]: unknown;
  id: string;
  date: string;
  status: string;
  statusDescription: string;
}

// ── Helpers ────────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  INICIAL: 'Inicial',
  PRIMARIO: 'Primario',
  SECUNDARIO: 'Secundario',
  TERCIARIO: 'Terciario',
  ADMINISTRACION: 'Administración',
};

function levelLabel(level: string): string {
  const n = parseInt(level, 10);
  if (!isNaN(n)) {
    const map: Record<number, string> = {
      1: 'Inicial',
      2: 'Primario',
      3: 'Secundario',
      4: 'Terciario',
      9: 'Administración',
    };
    return map[n] ?? level;
  }
  return LEVEL_LABELS[level] ?? level;
}

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

// ── Component ──────────────────────────────────────────────

interface StudentLegajoProps {
  studentId: string;
  institutionId?: string;
}

export function StudentLegajo({ studentId, institutionId }: StudentLegajoProps) {
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingLegajo, setLoadingLegajo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!studentId) return;

    setSelectedStudent(null);
    setEnrollments([]);
    setNotas([]);
    setAttendance([]);
    setError('');
    setLoadingLegajo(true);

    const tenantParams = institutionId ? { institutionId } : {};

    Promise.allSettled([
      apiClient.get(`/students/${studentId}`, { params: tenantParams }),
      apiClient.get('/enrollments', { params: { studentId, ...tenantParams } }),
      apiClient.get('/notas', { params: { studentId, ...tenantParams } }),
      apiClient.get('/attendance', { params: { studentId, ...tenantParams } }),
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

      // Enrollments (optional)
      if (results[1].status === 'fulfilled') {
        setEnrollments(
          (results[1] as { value?: { data?: { data?: Enrollment[] } } }).value?.data?.data ?? [],
        );
      } else {
        setEnrollments([]);
      }

      // Notas (optional)
      if (results[2].status === 'fulfilled') {
        setNotas(
          (results[2] as { value?: { data?: { data?: Nota[] } } }).value?.data?.data ?? [],
        );
      } else {
        setNotas([]);
      }

      // Attendance (optional)
      if (results[3].status === 'fulfilled') {
        setAttendance(
          (results[3] as { value?: { data?: { data?: AttendanceRecord[] } } }).value?.data
            ?.data ?? [],
        );
      } else {
        setAttendance([]);
      }

      setLoadingLegajo(false);
    });
  }, [studentId, institutionId]);

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

      {/* ── Matrículas ── */}
      <Card title={`Matrículas (${enrollments.length})`} className="mt-md">
        <Table
          columns={[
            { key: 'academicYear', header: 'Año lectivo' },
            { key: 'level', header: 'Nivel', render: (e: Enrollment) => levelLabel(e.level) },
            { key: 'grade', header: 'Grado/Año', render: (e: Enrollment) => e.grade || '-' },
            {
              key: 'division',
              header: 'División',
              render: (e: Enrollment) => e.division || '-',
            },
            { key: 'status', header: 'Estado' },
            {
              key: 'enrolledAt',
              header: 'Fecha',
              render: (e: Enrollment) => formatDateTime(e.enrolledAt),
            },
          ]}
          data={enrollments}
          emptyMessage="Sin matrículas registradas"
        />
      </Card>

      {/* ── Calificaciones ── */}
      <Card
        title={`Calificaciones (${notas.length} registros)${notas.length === 0 ? ' — sin datos disponibles' : ''}`}
        className="mt-md"
      >
        {notas.length === 0 ? (
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
              { key: 'evaluationId', header: 'Evaluación ID' },
              {
                key: 'numericValue',
                header: 'Nota num.',
                render: (n: Nota) => n.numericValue ?? '-',
              },
              {
                key: 'qualitativeValue',
                header: 'Nota cual.',
                render: (n: Nota) => n.qualitativeValue ?? '-',
              },
              { key: 'gradeCode', header: 'Código' },
              { key: 'gradeLabel', header: 'Concepto', render: (n: Nota) => n.gradeLabel ?? '-' },
            ]}
            data={notas}
            emptyMessage="Sin calificaciones registradas"
          />
        )}
      </Card>

      {/* ── Asistencia ── */}
      <Card
        title={`Asistencia (${attendance.length} registros)${attendance.length === 0 ? ' — sin datos disponibles' : ''}`}
        className="mt-md"
      >
        {attendance.length === 0 ? (
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-muted)',
              padding: 'var(--space-md)',
            }}
          >
            No hay registros de asistencia para este alumno.
          </p>
        ) : (
          <Table
            columns={[
              {
                key: 'date',
                header: 'Fecha',
                render: (a: AttendanceRecord) => formatDate(a.date),
              },
              { key: 'status', header: 'Código' },
              {
                key: 'statusDescription',
                header: 'Estado',
                render: (a: AttendanceRecord) => a.statusDescription,
              },
            ]}
            data={attendance}
            emptyMessage="Sin registros de asistencia"
          />
        )}
      </Card>

      <style>{`
        .legajo-label { font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: 0.15rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .legajo-value { font-size: var(--text-base); font-weight: 500; }
      `}</style>
    </div>
  );
}
