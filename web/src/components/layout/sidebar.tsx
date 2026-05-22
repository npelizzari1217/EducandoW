import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import './sidebar.css';

interface NavItem {
  label: string;
  path: string;
  roles?: string[];
  requiresLevel?: boolean;   // Show only when institution has at least one level
  featureFlag?: 'send_email' | 'send_messages'; // Show only when this flag is true
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/' },
  { label: 'Instituciones', path: '/institutions', roles: ['ADMIN'] },
  { label: 'Estudiantes', path: '/students', requiresLevel: true },
  { label: 'Docentes', path: '/teachers', requiresLevel: true },
  { label: 'Inscripciones', path: '/enrollments', requiresLevel: true },
  { label: 'Materias', path: '/subjects', requiresLevel: true },
  { label: 'Cursos', path: '/course-sections', requiresLevel: true },
  { label: 'Asignaciones', path: '/subject-assignments', requiresLevel: true },
  { label: 'Calificaciones', path: '/grades', requiresLevel: true },
  { label: 'Asistencia', path: '/attendance', requiresLevel: true },
  { label: 'Configuración SMTP', path: '/smtp-config', featureFlag: 'send_email' },
  { label: 'WebSocket', path: '/websocket-config', featureFlag: 'send_messages' },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const { config } = useInstitution();
  const navigate = useNavigate();

  const hasLevels = config.levels.length > 0;

  const filteredItems = navItems.filter(item => {
    // Role-based filtering (existing logic)
    if (item.roles && user && !item.roles.includes(user.role)) return false;
    // Level-based filtering: items that require a level are hidden when no levels configured
    if (item.requiresLevel && !hasLevels) return false;
    // Feature flag filtering
    if (item.featureFlag === 'send_email' && !config.send_email) return false;
    if (item.featureFlag === 'send_messages' && !config.send_messages) return false;
    return true;
  });

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
        {filteredItems.map(item => (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`} end={item.path === '/'}>
            {item.label}
          </NavLink>
        ))}
        {!hasLevels && (
          <div className="sidebar-placeholder">No hay niveles configurados</div>
        )}
      </nav>
      <button className="sidebar-logout" onClick={handleLogout}>Cerrar sesión</button>
    </aside>
  );
}
