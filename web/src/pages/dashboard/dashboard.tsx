import { useAuth } from '../../context/auth-context';
import { Card } from '../../components/ui/card';

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Bienvenido, {user?.name}</p></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
        <Card title="Estudiantes"><p className="text-muted">Gestión de alumnos, inscripciones y seguimiento académico.</p></Card>
        <Card title="Docentes"><p className="text-muted">Gestión de docentes y su asignación a ciclos lectivos.</p></Card>
        <Card title="Calificaciones"><p className="text-muted">Carga de notas con estrategia de evaluación por nivel.</p></Card>
        <Card title="Asistencia"><p className="text-muted">Registro diario de presentes, ausentes y tardes.</p></Card>
      </div>
    </div>
  );
}
