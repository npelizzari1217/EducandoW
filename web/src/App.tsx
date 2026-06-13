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
import { AttendancePage } from './pages/dashboard/pedagogy-pages';
import {
  EvaluacionesPage,
  NotasPage,
  PeriodosPage,
  NotasTrimestralesPage,
} from './pages/dashboard/evaluation-pages';
import ModulesPage from './pages/dashboard/modules';
import UsersPage from './pages/dashboard/users';
import ProfilesPage from './pages/dashboard/profiles';
import LegajosPage from './pages/dashboard/legajos';
import StudyPlansPage from './pages/dashboard/study-plans';
import SalasPage from './niveles/inicial/salas/page';
import InformesPage from './niveles/inicial/informes/page';
import PlanificacionesPage from './niveles/inicial/planificaciones/page';
import GradosPage from './niveles/primario/grados/page';
import CalificacionesPrimarioPage from './niveles/primario/calificaciones/page';
import CursosPage from './niveles/secundario/cursos/page';
import MesasExamenPage from './niveles/secundario/mesas-examen/page';
import ExamenesSuplementariosPage from './niveles/secundario/examenes-suplementarios/page';
import CarrerasPage from './niveles/terciario/carreras/page';
import InscripcionesPage from './niveles/terciario/inscripciones/page';
import CourseCyclesPage from './pages/dashboard/course-cycles';
import MateriasGruposPage from './pages/dashboard/materia-grupos';
import AttendanceTypesPage from './pages/dashboard/attendance-types';
import AcademicCyclesPage from './pages/dashboard/academic-cycles';
import ObservationsPage from './pages/dashboard/observations';
import ObservationsByCyclePage from './pages/dashboard/observations-by-cycle';
import GradingScalesPage from './pages/dashboard/grading-scales';
import GradingPeriodsPage from './pages/dashboard/grading-periods';
import SubjectGradingBySubjectPage from './pages/dashboard/subject-grading-by-subject';
import SubjectGradingByCoursePage from './pages/dashboard/subject-grading-by-course';
import IngresantesPage from './pages/dashboard/ingresantes';
import GestionGruposPage from './pages/dashboard/gestion-grupos';

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
              <Route path="/evaluaciones" element={<EvaluacionesPage />} />
              <Route path="/evaluaciones/notas" element={<NotasPage />} />
              <Route path="/periodos" element={<PeriodosPage />} />
              <Route path="/notas-trimestrales" element={<NotasTrimestralesPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/modules" element={<ProtectedRoute moduleCode="MODULES" action="READ"><ModulesPage /></ProtectedRoute>} />
              <Route path="/profiles" element={<ProtectedRoute moduleCode="USERS" action="READ"><ProfilesPage /></ProtectedRoute>} />
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
              <Route path="/secundario/examenes-suplementarios" element={<ExamenesSuplementariosPage />} />
              {/* Terciario */}
              <Route path="/terciario/carreras" element={<CarrerasPage />} />
              <Route path="/terciario/inscripciones" element={<InscripcionesPage />} />
              <Route path="/course-cycles" element={<CourseCyclesPage />} />
              {/* F7-N1/N3: Materias route — GRADES module required */}
              <Route path="/course-cycles/:ccId/materias" element={<MateriasGruposPage />} />
              <Route path="/academic-cycles" element={<ProtectedRoute moduleCode="COURSES" action="READ"><AcademicCyclesPage /></ProtectedRoute>} />
              <Route path="/observations" element={<ObservationsPage />} />
              <Route path="/observations-by-cycle" element={<ObservationsByCyclePage />} />
              <Route path="/attendance-types" element={<ProtectedRoute moduleCode="ATTENDANCE_TYPES" action="READ"><AttendanceTypesPage /></ProtectedRoute>} />
              <Route path="/grading-scales" element={<ProtectedRoute moduleCode="GRADING_CONFIG" action="READ"><GradingScalesPage /></ProtectedRoute>} />
              <Route path="/grading-periods" element={<ProtectedRoute moduleCode="GRADING_CONFIG" action="READ"><GradingPeriodsPage /></ProtectedRoute>} />
              {/* PR5-T7 / PR6: /competency-grading serves SubjectGradingBySubject (Primario + Secundario) */}
              <Route path="/competency-grading" element={<SubjectGradingBySubjectPage />} />
              {/* PR6-T3: /grading/by-course — SubjectGradingByCourse (homeroom/student view, Primario + Secundario) */}
              <Route path="/grading/by-course" element={<SubjectGradingByCoursePage />} />
              <Route path="/ingresantes" element={<IngresantesPage />} />
              <Route path="/grupos" element={<GestionGruposPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </InstitutionProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
