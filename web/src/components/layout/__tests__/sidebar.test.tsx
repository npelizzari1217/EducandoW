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
let mockLevels: string[] = ['INICIAL', 'PRIMARIO', 'SECUNDARIO', 'TERCIARIO'];
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
    },
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLevels = ['INICIAL', 'PRIMARIO', 'SECUNDARIO', 'TERCIARIO'];
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
    expect(screen.queryByText('Materias')).not.toBeInTheDocument();
    expect(screen.queryByText('Cursos')).not.toBeInTheDocument();
    expect(screen.queryByText('Asignaciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Calificaciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Asistencia')).not.toBeInTheDocument();
  });

  it('shows academic nav items when institution has at least one level', () => {
    mockLevels = ['INICIAL'];
    renderSidebar();

    expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    expect(screen.getByText('Docentes')).toBeInTheDocument();
    expect(screen.getByText('Inscripciones')).toBeInTheDocument();
    expect(screen.getByText('Materias')).toBeInTheDocument();
    expect(screen.getByText('Cursos')).toBeInTheDocument();
    expect(screen.getByText('Calificaciones')).toBeInTheDocument();
    expect(screen.getByText('Asistencia')).toBeInTheDocument();
  });

  it('shows placeholder when levels array is empty', () => {
    mockLevels = [];
    renderSidebar();

    expect(screen.getByText(/No hay niveles configurados/i)).toBeInTheDocument();
  });

  it('does NOT show placeholder when levels exist', () => {
    mockLevels = ['INICIAL'];
    renderSidebar();

    expect(screen.queryByText(/No hay niveles configurados/i)).not.toBeInTheDocument();
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
    mockLevels = ['INICIAL', 'PRIMARIO', 'SECUNDARIO', 'TERCIARIO'];
    mockSendEmail = true;
    mockSendMessages = true;
    renderSidebar();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Instituciones')).toBeInTheDocument();
    expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    expect(screen.getByText('Docentes')).toBeInTheDocument();
    expect(screen.getByText('Configuración SMTP')).toBeInTheDocument();
    expect(screen.getByText('WebSocket')).toBeInTheDocument();
  });
});
