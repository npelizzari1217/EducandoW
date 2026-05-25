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
import { SubjectsPage, CourseSectionsPage, SubjectAssignmentsPage, GradesPage, AttendancePage } from './pages/dashboard/pedagogy-pages';
import ModulesPage from './pages/dashboard/modules';
import UsersPage from './pages/dashboard/users';
import LegajosPage from './pages/dashboard/legajos';

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
              <Route path="/institutions" element={<ProtectedRoute roles={['ADMIN']}><InstitutionsPage /></ProtectedRoute>} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/teachers" element={<TeachersPage />} />
              <Route path="/enrollments" element={<EnrollmentsPage />} />
              <Route path="/subjects" element={<SubjectsPage />} />
              <Route path="/course-sections" element={<CourseSectionsPage />} />
              <Route path="/subject-assignments" element={<SubjectAssignmentsPage />} />
              <Route path="/grades" element={<GradesPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/modules" element={<ProtectedRoute roles={['ROOT']}><ModulesPage /></ProtectedRoute>} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/legajos" element={<LegajosPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </InstitutionProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
