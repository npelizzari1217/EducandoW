import { Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/error-boundary';
import { AuthProvider } from './context/auth-context';
import { InstitutionProvider } from './context/institution-context';
import { ThemeApplier } from './components/theme/theme-applier';
import { ProtectedRoute } from './components/layout/protected-route';
import { DashboardLayout } from './components/layout/dashboard-layout';
import LoginPage from './pages/auth/login';
import RegisterPage from './pages/auth/register';
import DashboardPage from './pages/dashboard/dashboard';
import InstitutionsPage from './pages/dashboard/institutions';
import StudentsPage from './pages/dashboard/students';
import TeachersPage from './pages/dashboard/teachers';
import EnrollmentsPage from './pages/dashboard/enrollments';
import { GradesPage, AttendancePage } from './pages/dashboard/pedagogy-pages';
import ModulesPage from './pages/dashboard/modules';
import UsersPage from './pages/dashboard/users';
import LegajosPage from './pages/dashboard/legajos';
import StudyPlansPage from './pages/dashboard/study-plans';
import SalasPage from './niveles/inicial/salas/page';
import InformesPage from './niveles/inicial/informes/page';
import PlanificacionesPage from './niveles/inicial/planificaciones/page';
import GradosPage from './niveles/primario/grados/page';
import CalificacionesPrimarioPage from './niveles/primario/calificaciones/page';
import CursosPage from './niveles/secundario/cursos/page';
import MesasExamenPage from './niveles/secundario/mesas-examen/page';
import CarrerasPage from './niveles/terciario/carreras/page';
import InscripcionesPage from './niveles/terciario/inscripciones/page';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <InstitutionProvider>
          <ThemeApplier />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/institutions" element={<ProtectedRoute moduleCode="INSTITUTIONS" action="READ"><InstitutionsPage /></ProtectedRoute>} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/teachers" element={<TeachersPage />} />
              <Route path="/enrollments" element={<EnrollmentsPage />} />
              <Route path="/grades" element={<GradesPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/modules" element={<ProtectedRoute moduleCode="MODULES" action="READ"><ModulesPage /></ProtectedRoute>} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/legajos" element={<LegajosPage />} />
              <Route path="/study-plans" element={<StudyPlansPage />} />
              {/* Inicial */}
              <Route path="/inicial/salas" element={<SalasPage />} />
              <Route path="/inicial/informes" element={<InformesPage />} />
              <Route path="/inicial/planificaciones" element={<PlanificacionesPage />} />
              {/* Primario */}
              <Route path="/primario/grados" element={<GradosPage />} />
              <Route path="/primario/calificaciones" element={<CalificacionesPrimarioPage />} />
              {/* Secundario */}
              <Route path="/secundario/cursos" element={<CursosPage />} />
              <Route path="/secundario/mesas-examen" element={<MesasExamenPage />} />
              {/* Terciario */}
              <Route path="/terciario/carreras" element={<CarrerasPage />} />
              <Route path="/terciario/inscripciones" element={<InscripcionesPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </InstitutionProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
