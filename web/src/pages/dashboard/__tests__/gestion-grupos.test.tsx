import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiDelete = vi.fn();
const mockApiPatch = vi.fn();

vi.mock('../../../api/client', () => ({
  default: { get: mockApiGet, post: mockApiPost, patch: mockApiPatch, delete: mockApiDelete },
}));

vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: { id: 'inst-1', name: 'Escuela Test', levels: [30], send_email: false, send_messages: false,
              logo_url: null, header_color: null, header_text_color: null, body_color: null,
              body_text_color: null, footer_color: null, footer_text_color: null },
    isLoading: false, error: null, reload: vi.fn(), clear: vi.fn(),
  }),
}));

let mockUser = {
  id: 'admin-1', email: 'admin@test.com', name: 'Admin User',
  role: 'ADMIN', roles: ['ADMIN'],
  institutionId: 'inst-1', levels: [30],
  userLevels: [{ level: 3, modality: 0 }],
  modules: [{ moduleCode: 'COURSE_CYCLES', actions: ['READ', 'WRITE'] }],
};

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({ user: mockUser, logout: vi.fn(), isLoading: false, login: vi.fn(), accessToken: 'fake' }),
}));

const mockGrupos = [
  {
    id: 'g-1', name: 'Grupo A', docenteName: 'Ana García', docenteUserId: 'teacher-1',
    materiaId: 'm-1', subjectName: 'Matemática', courseCycleId: 'cc-1',
    courseName: 'Primer Año A', level: 30, alumnosCount: 15,
  },
  {
    id: 'g-2', name: 'Grupo B', docenteName: 'Carlos López', docenteUserId: 'teacher-2',
    materiaId: 'm-1', subjectName: 'Matemática', courseCycleId: 'cc-1',
    courseName: 'Primer Año A', level: 30, alumnosCount: 12,
  },
];

const mockCourseCycles = [
  { uuid: 'cc-1', courseName: 'Primer Año A', level: 30 },
];

const mockMaterias = [
  { id: 'm-1', subjectName: 'Matemática' },
];

const mockTeachers = [
  { id: 'teacher-1', name: 'Ana García' },
  { id: 'teacher-2', name: 'Carlos López' },
];

function setupDefaultMocks() {
  mockApiGet.mockImplementation((url: string, _config?: { params?: Record<string, string> }) => {
    if (url === '/grupos') return Promise.resolve({ data: mockGrupos });
    if (url === '/institutions') return Promise.resolve({ data: { data: [{ id: 'inst-1', name: 'Escuela Test' }] } });
    if (url === '/course-cycles') return Promise.resolve({ data: { data: mockCourseCycles } });
    if (url.includes('/materias') && !url.includes('/alumnos') && !url.includes('/grupos'))
      return Promise.resolve({ data: { data: mockMaterias } });
    if (url.includes('/alumnos')) return Promise.resolve({ data: [] });
    if (url.includes('/users')) return Promise.resolve({ data: { data: mockTeachers } });
    return Promise.resolve({ data: [] });
  });
}

let GestionGruposPage: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  setupDefaultMocks();
  const module = await import('../gestion-grupos');
  GestionGruposPage = module.default;
});

afterEach(() => cleanup());

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/grupos']}>
      <Routes>
        <Route path="/grupos" element={<GestionGruposPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GG — Gestión de Grupos', () => {
  it('GG-T1: renderiza la lista de grupos en mount', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Grupo A')).toBeInTheDocument());
    expect(screen.getByText('Grupo B')).toBeInTheDocument();
    expect(screen.getByText('Ana García')).toBeInTheDocument();
    expect(screen.getByText('Matemática')).toBeInTheDocument();
  });

  it('GG-T2: cambiar nivel resetea CC y materia filters', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));

    const levelSelect = screen.getByTestId('filter-level');
    await userEvent.selectOptions(levelSelect, '30');

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/course-cycles', expect.objectContaining({ params: expect.objectContaining({ level: '30' }) })));

    await userEvent.selectOptions(levelSelect, '');
    expect(screen.getByTestId('filter-course-cycle')).toHaveValue('');
    expect(screen.getByTestId('filter-materia')).toHaveValue('');
  });

  it('GG-T3: cambiar CC resetea solo el filtro de materia', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));

    const levelSelect = screen.getByTestId('filter-level');
    await userEvent.selectOptions(levelSelect, '30');
    await waitFor(() => expect(screen.getByTestId('filter-course-cycle')).not.toBeDisabled());

    const ccSelect = screen.getByTestId('filter-course-cycle');
    await userEvent.selectOptions(ccSelect, 'cc-1');

    expect(levelSelect).toHaveValue('30');

    await userEvent.selectOptions(ccSelect, '');
    expect(screen.getByTestId('filter-materia')).toHaveValue('');
  });

  it('GG-T4: muestra mensaje cuando no hay grupos', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/grupos') return Promise.resolve({ data: [] });
      if (url === '/institutions') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: [] });
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/sin grupos/i)).toBeInTheDocument());
  });

  it('GG-T5: click Crear abre el formulario', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));

    const btnCrear = screen.getByTestId('btn-crear-grupo');
    await userEvent.click(btnCrear);

    expect(screen.getByTestId('form-grupo')).toBeInTheDocument();
  });

  it('GG-T6: click Editar en un grupo abre el form con datos del grupo', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/grupos') return Promise.resolve({ data: mockGrupos });
      if (url === '/grupos/g-1/alumnos') return Promise.resolve({ data: [] });
      if (url === '/institutions') return Promise.resolve({ data: { data: [{ id: 'inst-1', name: 'Escuela Test' }] } });
      if (url === '/course-cycles') return Promise.resolve({ data: { data: mockCourseCycles } });
      if (url.includes('/materias')) return Promise.resolve({ data: { data: mockMaterias } });
      if (url.includes('/users')) return Promise.resolve({ data: { data: mockTeachers } });
      return Promise.resolve({ data: [] });
    });
    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));

    const btnEditar = screen.getByTestId('btn-editar-g-1');
    await userEvent.click(btnEditar);

    await waitFor(() => expect(screen.getByTestId('form-grupo')).toBeInTheDocument());
    expect(screen.getByTestId('form-nombre')).toHaveValue('Grupo A');
  });

  it('GG-T7: click Borrar muestra confirmación y al confirmar llama DELETE', async () => {
    mockApiDelete.mockResolvedValue({ data: {} });
    renderPage();
    await waitFor(() => screen.getByText('Grupo A'));

    await userEvent.click(screen.getByTestId('btn-borrar-g-1'));

    await waitFor(() => expect(screen.getByTestId('confirm-delete')).toBeInTheDocument());

    await userEvent.click(screen.getByTestId('btn-confirm-delete'));

    await waitFor(() => expect(mockApiDelete).toHaveBeenCalledWith('/grupos/g-1', { params: { institutionId: 'inst-1' } }));
  });
});
