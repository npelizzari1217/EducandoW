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
  { label: 'Legajos', path: '/legajos', requiresLevel: true },
  { label: 'Materias', path: '/subjects', requiresLevel: true },
  { label: 'Cursos', path: '/course-sections', requiresLevel: true },
  { label: 'Asignaciones', path: '/subject-assignments', requiresLevel: true },
  { label: 'Planes de Estudio', path: '/study-plans', requiresLevel: true },
  { label: 'Calificaciones', path: '/grades', requiresLevel: true },
  { label: 'Asistencia', path: '/attendance', requiresLevel: true },
  { label: 'Usuarios', path: '/users', roles: ['ROOT', 'ADMIN', 'MANAGER'] },
  { label: 'Módulos', path: '/modules', roles: ['ROOT'] },
  { label: 'Configuración SMTP', path: '/smtp-config', featureFlag: 'send_email' },
  { label: 'WebSocket', path: '/websocket-config', featureFlag: 'send_messages' },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
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
    <aside
      className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
      data-sidebar-open={isOpen}
    >
      <button
        className="sidebar-close"
        onClick={onToggle}
        aria-label="Cerrar menú"
      >
        ✕
      </button>

      <div className="sidebar-brand" title="EducandoW">
        <img className="sidebar-logo" src="/EducandoW4_02.jpeg" alt="EducandoW" />
      </div>

      {config.name && (
        <div className="sidebar-institution" title={config.name}>
          {config.logo_url ? (
            <img
              className="sidebar-institution-logo"
              src={config.logo_url}
              alt={config.name}
            />
          ) : (
            <span className="sidebar-institution-icon">🏫</span>
          )}
          <span className="sidebar-institution-name">{config.name}</span>
        </div>
      )}

      <div className="sidebar-user" title={user?.name}>
        <div className="sidebar-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-role">{user?.role}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {filteredItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
            title={item.label}
            end={item.path === '/'}
          >
            <span className="sidebar-link-icon">{item.label.charAt(0)}</span>
            <span className="sidebar-link-text">{item.label}</span>
          </NavLink>
        ))}
        {!hasLevels && (
          <div className="sidebar-placeholder">
            <span className="sidebar-placeholder-icon">⚠</span>
            <span className="sidebar-placeholder-text">No hay niveles configurados</span>
          </div>
        )}
      </nav>

      <button className="sidebar-logout" onClick={handleLogout} title="Cerrar sesión">
        <span className="sidebar-logout-icon">⏻</span>
        <span className="sidebar-logout-text">Cerrar sesión</span>
      </button>
    </aside>
  );
}
