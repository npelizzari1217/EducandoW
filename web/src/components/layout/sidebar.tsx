import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { useInstitution } from '../../context/institution-context';
import { SidebarGroup } from './SidebarGroup';
import './sidebar.css';

interface NavItem {
  label: string;
  path: string;
  roles?: string[];
  requiresLevel?: boolean;   // Show only when institution has at least one level
  levelId?: number;          // 1=Inicial, 2=Nivel Primario, 3=Secundario, 4=Terciario
  featureFlag?: 'send_email' | 'send_messages'; // Show only when this flag is true
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Inicial',
  2: 'Nivel Primario',
  3: 'Secundario',
  4: 'Terciario',
};

interface NavGroupDef {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}

const navGroups: NavGroupDef[] = [
  {
    id: 'secretarios',
    label: 'Secretarios',
    icon: '📁',
    items: [
      { label: 'Estudiantes', path: '/students', requiresLevel: true },
      { label: 'Docentes', path: '/teachers', requiresLevel: true },
      { label: 'Inscripciones', path: '/enrollments', requiresLevel: true },
      { label: 'Legajos', path: '/legajos', requiresLevel: true },
      { label: 'Planes de Estudio', path: '/study-plans', requiresLevel: true },
      { label: 'Usuarios', path: '/users', roles: ['ROOT', 'ADMIN', 'MANAGER'] },
    ],
  },
  {
    id: 'academico',
    label: 'Académico',
    icon: '📁',
    items: [
      // Generic — visible when any level exists
      { label: 'Alumnos por curso', path: '/students-by-course', requiresLevel: true },
      { label: 'Calificaciones parciales', path: '/grades', requiresLevel: true },
      { label: 'Asistencia del día', path: '/attendance', requiresLevel: true },
      // Inicial (levelId: 1)
      { label: 'Salas', path: '/inicial/salas', requiresLevel: true, levelId: 1 },
      { label: 'Informes Evolutivos', path: '/inicial/informes', requiresLevel: true, levelId: 1 },
      { label: 'Planificaciones', path: '/inicial/planificaciones', requiresLevel: true, levelId: 1 },
      // Nivel Primario (levelId: 2)
      { label: 'Grados', path: '/primario/grados', requiresLevel: true, levelId: 2 },
      { label: 'Calificaciones', path: '/primario/calificaciones', requiresLevel: true, levelId: 2 },
      // Secundario (levelId: 3)
      { label: 'Cursos', path: '/secundario/cursos', requiresLevel: true, levelId: 3 },
      { label: 'Mesas de Examen', path: '/secundario/mesas-examen', requiresLevel: true, levelId: 3 },
      // Terciario (levelId: 4)
      { label: 'Carreras', path: '/terciario/carreras', requiresLevel: true, levelId: 4 },
      { label: 'Inscripciones', path: '/terciario/inscripciones', requiresLevel: true, levelId: 4 },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    icon: '📁',
    items: [
      { label: 'Instituciones', path: '/institutions', roles: ['ROOT', 'ADMIN'] },
      { label: 'Módulos', path: '/modules', roles: ['ROOT'] },
      { label: 'Configuración SMTP', path: '/smtp-config', featureFlag: 'send_email' },
      { label: 'WebSocket', path: '/websocket-config', featureFlag: 'send_messages' },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

function makeFilterItem(
  user: { role: string } | null,
  hasLevels: boolean,
  baseLevels: Set<number>,
  sendEmail: boolean,
  sendMessages: boolean,
) {
  return (item: NavItem): boolean => {
    if (item.roles && user && !item.roles.includes(user.role)) return false;
    // ROOT sees all items regardless of levels — they manage the whole system
    if (item.requiresLevel && !hasLevels && user?.role !== 'ROOT') return false;
    // Level-specific filter: hide items for levels not configured
    // ROOT bypasses this check — sees everything
    if (item.levelId !== undefined && user?.role !== 'ROOT' && !baseLevels.has(item.levelId)) return false;
    if (item.featureFlag === 'send_email' && !sendEmail) return false;
    if (item.featureFlag === 'send_messages' && !sendMessages) return false;
    return true;
  };
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const { config } = useInstitution();
  const navigate = useNavigate();

  // Derive base levels from user's JWT levels (primary), fall back to institution config.
  // Composite codes from JWT: level*10+modality → base level = Math.floor(code/10).
  const userBaseLevels = new Set((user?.levels ?? []).map((code) => Math.floor(code / 10)));
  const institutionBaseLevels = new Set(config.levels.map((code) => Math.floor(code / 10)));

  const effectiveBaseLevels = userBaseLevels.size > 0 ? userBaseLevels : institutionBaseLevels;
  const hasLevels = effectiveBaseLevels.size > 0;

  const filterItem = makeFilterItem(user, hasLevels, effectiveBaseLevels, config.send_email, config.send_messages);

  // Build visible groups (filter items, skip empty groups).
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      visibleItems: group.items.filter(filterItem),
    }))
    .filter((group) => group.visibleItems.length > 0);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const renderLink = (item: NavItem) => (
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
  );

  function renderGroupItems(items: NavItem[]) {
    let currentLevel: number | undefined;
    const elements: React.ReactNode[] = [];
    for (const item of items) {
      if (item.levelId !== undefined && item.levelId !== currentLevel) {
        currentLevel = item.levelId;
        elements.push(
          <div key={`section-${item.levelId}`} className="sidebar-section-label">
            {LEVEL_LABELS[item.levelId]}
          </div>,
        );
      }
      elements.push(renderLink(item));
    }
    return elements;
  }

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
        {/* Dashboard — always visible, outside groups */}
        {renderLink({ label: 'Dashboard', path: '/' })}

        {visibleGroups.map((group) => (
          <SidebarGroup
            key={group.id}
            id={group.id}
            label={group.label}
            icon={group.icon}
          >
            {renderGroupItems(group.visibleItems)}
          </SidebarGroup>
        ))}

        {!hasLevels && user?.role === 'ADMIN' && (
          <div className="sidebar-placeholder sidebar-placeholder-warning">
            <span className="sidebar-placeholder-icon">⚠</span>
            <span className="sidebar-placeholder-text">
              No tenés niveles educativos asignados. Configurá los niveles en tu institución o contactá a un administrador para que te asigne niveles.
            </span>
            <NavLink to="/institutions" className="sidebar-placeholder-link">
              Ir a configuración
            </NavLink>
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
