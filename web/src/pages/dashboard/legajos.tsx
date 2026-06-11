import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import PremiumHeader from '../../components/ui/premium-header';
import { Card } from '../../components/ui/card';
import { Table } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import apiClient from '../../api/client';
import { StudentLegajo } from './components/StudentLegajo';

// ── Tipos ─────────────────────────────────────────────────

interface StudentSummary {
  [key: string]: unknown;
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  fullName: string;
}

// ── Componente ────────────────────────────────────────────

export default function LegajosPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudentSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

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

  const selectStudent = (student: StudentSummary) => {
    setSelectedStudentId(student.id);
    setSearchResults([]);
    setQuery('');
  };

  const handlePrint = () => window.print();

  return (
    <div>
      <PremiumHeader
        title="Legajos de Alumnos"
        subtitle="Ficha completa del alumno: datos, matrículas, calificaciones y asistencia"
        icon="📄"
      >
        {selectedStudentId && (
          <Button variant="action" onClick={handlePrint} title="Imprimir legajo">🖨 Imprimir</Button>
        )}
      </PremiumHeader>

      {/* Búsqueda */}
      {!selectedStudentId && (
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
                    render: (s: StudentSummary) => (
                      <Button variant="action" size="sm" onClick={() => selectStudent(s)}>
                        Ver legajo
                      </Button>
                    ),
                  },
                ]}
                data={searchResults}
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

      {/* Legajo del alumno seleccionado — reutiliza el componente compartido */}
      {selectedStudentId && (
        <div className="legajo-content">
          <StudentLegajo studentId={selectedStudentId} institutionId={institutionId || undefined} />

          {/* Botón volver */}
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <Button variant="ghost" onClick={() => { setSelectedStudentId(null); setQuery(''); }}>
              ← Buscar otro alumno
            </Button>
          </div>
        </div>
      )}

      {/* Estilos print */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .legajo-content, .legajo-content * { visibility: visible; }
          .legajo-content { position: absolute; left: 0; top: 0; width: 100%; padding: 1rem; }
          .mph-header { display: none; }
          button { display: none; }
        }
      `}</style>
    </div>
  );
}
