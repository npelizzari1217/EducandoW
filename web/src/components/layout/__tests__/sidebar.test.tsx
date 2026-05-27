import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../sidebar';

// ── Mock useAuth ──
const mockUser = {
  id: 'user-1',
  email: 'test@school.edu',
  name: 'María Gómez',
  role: 'ADMIN' as const,
};

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    accessToken: 'fake-token',
  }),
}));

// ── Mock useInstitution (configurable per test) ──
let mockLevels: number[] = [1, 2, 3, 4]; // match InstitutionConfig.levels: number[]
let mockSendEmail = true;
let mockSendMessages = true;

vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: {
      id: 'inst-1',
      name: 'Escuela Test',
      levels: mockLevels,
      send_email: mockSendEmail,
      send_messages: mockSendMessages,
      header_color: null,
      header_text_color: null,
      body_text_color: null,
      active: true,
    } as any,
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

const noop = () => {};

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar isOpen={true} onToggle={noop} />
    </MemoryRouter>,
  );
}

describe('Sidebar filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLevels = [1, 2, 3, 4];
    mockSendEmail = true;
    mockSendMessages = true;
  });

  it('always shows Dashboard link regardless of levels', () => {
    mockLevels = [];
    renderSidebar();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('always shows Instituciones link for ADMIN role', () => {
    renderSidebar();
    expect(screen.getByText('Instituciones')).toBeInTheDocument();
  });

  it('hides academic nav items when levels array is empty', () => {
    mockLevels = [];
    renderSidebar();

    expect(screen.queryByText('Estudiantes')).not.toBeInTheDocument();
    expect(screen.queryByText('Docentes')).not.toBeInTheDocument();
    expect(screen.queryByText('Inscripciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Legajos')).not.toBeInTheDocument();
    expect(screen.queryByText('Planes de Estudio')).not.toBeInTheDocument();
    expect(screen.queryByText('Calificaciones parciales')).not.toBeInTheDocument();
    expect(screen.queryByText('Asistencia del día')).not.toBeInTheDocument();
  });

  it('shows academic nav items when institution has at least one level', () => {
    mockLevels = [1];
    renderSidebar();

    expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    expect(screen.getByText('Docentes')).toBeInTheDocument();
    expect(screen.getByText('Inscripciones')).toBeInTheDocument();
    expect(screen.getByText('Legajos')).toBeInTheDocument();
    expect(screen.getByText('Planes de Estudio')).toBeInTheDocument();
    expect(screen.getByText('Calificaciones parciales')).toBeInTheDocument();
    expect(screen.getByText('Asistencia del día')).toBeInTheDocument();
  });

  it('shows placeholder when levels array is empty and user is ADMIN', () => {
    mockLevels = [];
    (mockUser as any).role = 'ADMIN';
    renderSidebar();

    expect(screen.getByText(/Configurá los niveles educativos/i)).toBeInTheDocument();
    expect(screen.getByText(/Ir a configuración/i)).toBeInTheDocument();
  });

  it('does NOT show placeholder for ROOT — ROOT sees all items regardless of levels', () => {
    mockLevels = [];
    (mockUser as any).role = 'ROOT';
    renderSidebar();

    // ROOT sees all nav items (Estudiantes, Docentes, etc.) even without levels
    expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    expect(screen.getByText('Docentes')).toBeInTheDocument();
    // Placeholder should NOT appear for ROOT
    expect(screen.queryByText(/Configurá los niveles educativos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ir a configuración/i)).not.toBeInTheDocument();
  });

  it('does NOT show placeholder when levels exist', () => {
    mockLevels = [1];
    renderSidebar();

    expect(screen.queryByText(/Configurá los niveles educativos/i)).not.toBeInTheDocument();
  });

  it('does NOT show placeholder for non-admin roles when levels empty', () => {
    mockLevels = [];
    (mockUser as any).role = 'MANAGER';
    renderSidebar();

    expect(screen.queryByText(/Configurá los niveles educativos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ir a configuración/i)).not.toBeInTheDocument();
  });

  it('shows SMTP config link when send_email is true', () => {
    mockSendEmail = true;
    renderSidebar();

    expect(screen.getByText('Configuración SMTP')).toBeInTheDocument();
  });

  it('hides SMTP config link when send_email is false', () => {
    mockSendEmail = false;
    renderSidebar();

    expect(screen.queryByText('Configuración SMTP')).not.toBeInTheDocument();
  });

  it('shows WebSocket config link when send_messages is true', () => {
    mockSendMessages = true;
    renderSidebar();

    expect(screen.getByText('WebSocket')).toBeInTheDocument();
  });

  it('hides WebSocket config link when send_messages is false', () => {
    mockSendMessages = false;
    renderSidebar();

    expect(screen.queryByText('WebSocket')).not.toBeInTheDocument();
  });

  it('shows all items when all levels and flags are active', () => {
    // Use ROOT role so Módulos (ROOT-only) is visible.
    // Use ROOT role so Módulos (ROOT-only) and Instituciones are visible.
    (mockUser as any).role = 'ROOT';
    mockLevels = [1, 2, 3, 4];
    mockSendEmail = true;
    mockSendMessages = true;
    renderSidebar();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    expect(screen.getByText('Docentes')).toBeInTheDocument();
    expect(screen.getByText('Calificaciones parciales')).toBeInTheDocument();
    expect(screen.getByText('Asistencia del día')).toBeInTheDocument();
    expect(screen.getByText('Instituciones')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
    expect(screen.getByText('Módulos')).toBeInTheDocument();
    expect(screen.getByText('Configuración SMTP')).toBeInTheDocument();
    expect(screen.getByText('WebSocket')).toBeInTheDocument();
  });

  it('renders group labels (Secretarios, Académico, Sistema)', () => {
    renderSidebar();

    expect(screen.getByText('Secretarios')).toBeInTheDocument();
    expect(screen.getByText('Académico')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
  });

  it('hides groups that have no visible items', () => {
    // With no levels, disabled feature flags, and a non-privileged role,
    // every group should end up empty.
    mockLevels = [];
    mockSendEmail = false;
    mockSendMessages = false;
    (mockUser as any).role = 'USER';

    renderSidebar();

    // Only Dashboard should be visible (no groups because all items are filtered)
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Secretarios')).not.toBeInTheDocument();
    expect(screen.queryByText('Académico')).not.toBeInTheDocument();
    expect(screen.queryByText('Sistema')).not.toBeInTheDocument();
  });
});
