import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import './sidebar.css';

const navItems = [
  { label: 'Dashboard', path: '/' },
  { label: 'Instituciones', path: '/institutions', roles: ['ADMIN'] },
  { label: 'Estudiantes', path: '/students' },
  { label: 'Docentes', path: '/teachers' },
  { label: 'Inscripciones', path: '/enrollments' },
  { label: 'Materias', path: '/subjects' },
  { label: 'Cursos', path: '/course-sections' },
  { label: 'Asignaciones', path: '/subject-assignments' },
  { label: 'Calificaciones', path: '/grades' },
  { label: 'Asistencia', path: '/attendance' },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">📚</span>
        <span className="sidebar-title">EducandoW</span>
      </div>
      <div className="sidebar-user">
        <div className="sidebar-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
        <div>
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-role">{user?.role}</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.filter(item => !item.roles || (user && item.roles.includes(user.role))).map(item => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`} end={item.path === '/'}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <button className="sidebar-logout" onClick={handleLogout}>Cerrar sesión</button>
    </aside>
  );
}
