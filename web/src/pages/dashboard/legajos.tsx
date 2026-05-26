import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import apiClient from '../../api/client';

// ── Tipos ─────────────────────────────────────────────────

interface StudentSummary {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  fullName: string;
}

interface StudentDetail {
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
  id: string;
  evaluationId: string;
  numericValue: number | null;
  qualitativeValue: string | null;
  gradeCode: string | null;
  gradeLabel: string | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  statusDescription: string;
}

// ── Helpers ───────────────────────────────────────────────

const LEVEL_LABELS: Record<string, string> = {
  INICIAL: 'Inicial', PRIMARIO: 'Primario', SECUNDARIO: 'Secundario', TERCIARIO: 'Terciario', ADMINISTRACION: 'Administración',
};

function levelLabel(level: string): string {
  const n = parseInt(level, 10);
  if (!isNaN(n)) {
    const map: Record<number, string> = { 1: 'Inicial', 2: 'Primario', 3: 'Secundario', 4: 'Terciario', 9: 'Administración' };
    return map[n] ?? level;
  }
  return LEVEL_LABELS[level] ?? level;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('es-AR');
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Componente ────────────────────────────────────────────

export default function LegajosPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudentSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingLegajo, setLoadingLegajo] = useState(false);
  const [error, setError] = useState('');

  const institutionId = user?.institutionId ?? '';

  // Búsqueda de alumnos
  const searchStudents = useCallback(async () => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await apiClient.get('/students/search', {
        params: { q: query, institutionId },
      });
      setSearchResults(res.data?.data ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [query, institutionId]);

  useEffect(() => {
    const timer = setTimeout(() => searchStudents(), 300);
    return () => clearTimeout(timer);
  }, [query, searchStudents]);

  // Cargar legajo completo al seleccionar alumno
  const selectStudent = async (student: StudentSummary) => {
    setSelectedStudent(null);
    setEnrollments([]);
    setNotas([]);
    setAttendance([]);
    setError('');
    setLoadingLegajo(true);
    setSearchResults([]);
    setQuery('');

    // Cargar cada sección de forma independiente — si una falla, mostramos las otras
    const results = await Promise.allSettled([
      apiClient.get(`/students/${student.id}`),
      apiClient.get('/enrollments', { params: { studentId: student.id } }),
      apiClient.get('/notas', { params: { studentId: student.id } }),
      apiClient.get('/attendance', { params: { studentId: student.id } }),
    ]);

    // Student detail (requerido)
    if (results[0].status === 'rejected' || !(results[0] as any).value?.data?.data) {
      setError('Alumno no encontrado');
      setLoadingLegajo(false);
      return;
    }
    setSelectedStudent((results[0] as any).value.data.data);

    // Enrollments (opcional)
    if (results[1].status === 'fulfilled') {
      setEnrollments((results[1] as any).value.data?.data ?? []);
    } else {
      setEnrollments([]);
    }

    // Notas (opcional)
    if (results[2].status === 'fulfilled') {
      setNotas((results[2] as any).value.data?.data ?? []);
    } else {
      setNotas([]);
    }

    // Attendance (opcional)
    if (results[3].status === 'fulfilled') {
      setAttendance((results[3] as any).value.data?.data ?? []);
    } else {
      setAttendance([]);
    }

    setLoadingLegajo(false);
  };

  const handlePrint = () => window.print();

  // ── Agrupar notas por evaluationId ──
  const notasGrouped = notas.reduce<Record<string, Nota[]>>((acc, n) => {
    const key = n.evaluationId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Legajos de Alumnos</h1>
          <p className="page-subtitle">Ficha completa del alumno: datos, matrículas, calificaciones y asistencia</p>
        </div>
        {selectedStudent && (
          <Button variant="action" onClick={handlePrint} title="Imprimir legajo">🖨 Imprimir</Button>
        )}
      </div>

      {/* Búsqueda */}
      {!selectedStudent && (
        <Card title="Buscar alumno" className="mt-md">
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end' }}>
            <Input
              label="Nombre o DNI"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Escribí al menos 2 caracteres..."
            />
          </div>
          {searching && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>Buscando...</p>}
          {searchResults.length > 0 && (
            <div style={{ marginTop: 'var(--space-md)' }}>
              <Table
                columns={[
                  { key: 'fullName', header: 'Nombre' },
                  { key: 'dni', header: 'DNI' },
                  {
                    key: 'actions', header: '',
                    render: (s: any) => (
                      <Button variant="action" size="sm" onClick={() => selectStudent(s as StudentSummary)}>
                        Ver legajo
                      </Button>
                    ),
                  },
                ]}
                data={searchResults as any}
                emptyMessage="Sin resultados"
              />
            </div>
          )}
          {!searching && query.length >= 2 && searchResults.length === 0 && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>
              No se encontraron alumnos con ese criterio.
            </p>
          )}
        </Card>
      )}

      {/* Legajo cargado */}
      {loadingLegajo && (
        <Card className="mt-md"><p style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>Cargando legajo...</p></Card>
      )}

      {error && (
        <Card className="mt-md">
          <p style={{ color: 'var(--color-danger)', padding: 'var(--space-md)' }}>{error}</p>
          <Button variant="ghost" onClick={() => setError('')}>Volver a buscar</Button>
        </Card>
      )}

      {selectedStudent && !loadingLegajo && (
        <div className="legajo-content">
          {/* ── Datos Personales ── */}
          <Card title="Datos Personales" className="mt-md">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div>
                <p className="legajo-label">Nombre completo</p>
                <p className="legajo-value">{selectedStudent.lastName}, {selectedStudent.firstName}</p>
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
                { key: 'level', header: 'Nivel', render: (e: any) => levelLabel((e as Enrollment).level) },
                { key: 'grade', header: 'Grado/Año', render: (e: any) => (e as Enrollment).grade || '-' },
                { key: 'division', header: 'División', render: (e: any) => (e as Enrollment).division || '-' },
                { key: 'status', header: 'Estado' },
                { key: 'enrolledAt', header: 'Fecha', render: (e: any) => formatDateTime((e as Enrollment).enrolledAt) },
              ]}
              data={enrollments as any}
              emptyMessage="Sin matrículas registradas"
            />
          </Card>

          {/* ── Calificaciones ── */}
          <Card title={`Calificaciones (${notas.length} registros)${notas.length === 0 ? ' — sin datos disponibles' : ''}`} className="mt-md">
            {notas.length === 0 ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', padding: 'var(--space-md)' }}>
                No hay calificaciones registradas para este alumno.
              </p>
            ) : (
              <Table
                columns={[
                  { key: 'evaluationId', header: 'Evaluación ID' },
                  { key: 'numericValue', header: 'Nota num.', render: (n: any) => (n as Nota).numericValue ?? '-' },
                  { key: 'qualitativeValue', header: 'Nota cual.', render: (n: any) => (n as Nota).qualitativeValue ?? '-' },
                  { key: 'gradeCode', header: 'Código' },
                  { key: 'gradeLabel', header: 'Concepto', render: (n: any) => (n as Nota).gradeLabel ?? '-' },
                ]}
                data={notas as any}
                emptyMessage="Sin calificaciones registradas"
              />
            )}
          </Card>

          {/* ── Asistencia ── */}
          <Card title={`Asistencia (${attendance.length} registros)${attendance.length === 0 ? ' — sin datos disponibles' : ''}`} className="mt-md">
            {attendance.length === 0 ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', padding: 'var(--space-md)' }}>
                No hay registros de asistencia para este alumno.
              </p>
            ) : (
              <Table
                columns={[
                  { key: 'date', header: 'Fecha', render: (a: any) => formatDate((a as AttendanceRecord).date) },
                  { key: 'status', header: 'Código' },
                  { key: 'statusDescription', header: 'Estado', render: (a: any) => (a as AttendanceRecord).statusDescription },
                ]}
                data={attendance as any}
                emptyMessage="Sin registros de asistencia"
              />
            )}
          </Card>

          {/* Botón volver */}
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <Button variant="ghost" onClick={() => { setSelectedStudent(null); setQuery(''); }}>
              ← Buscar otro alumno
            </Button>
          </div>
        </div>
      )}

      {/* Estilos inline + print */}
      <style>{`
        .legajo-label { font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: 0.15rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .legajo-value { font-size: var(--text-base); font-weight: 500; }
        @media print {
          body * { visibility: hidden; }
          .legajo-content, .legajo-content * { visibility: visible; }
          .legajo-content { position: absolute; left: 0; top: 0; width: 100%; padding: 1rem; }
          .page-header { visibility: visible; position: absolute; left: 0; top: 0; }
          button { display: none; }
        }
      `}</style>
    </div>
  );
}
