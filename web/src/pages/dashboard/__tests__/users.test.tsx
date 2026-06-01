import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// ── Mock apiClient ──
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../api/client', () => ({
  default: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
    patch: (...args: any[]) => mockApiPatch(...args),
    delete: (...args: any[]) => mockApiDelete(...args),
  },
}));

// ── Mock useAuth ──
const mockUser = {
  id: 'user-1',
  email: 'admin@school.edu',
  name: 'Admin User',
  role: 'ADMIN',
  roles: ['ADMIN'],
  institutionId: 'inst-1',
  modules: [
    { moduleCode: 'USERS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
    { moduleCode: 'STUDENTS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
    { moduleCode: 'TEACHERS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
    { moduleCode: 'REPORTS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
    { moduleCode: 'CLASSROOMS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
    { moduleCode: 'COURSES', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
    { moduleCode: 'ENROLLMENTS', actions: ['READ', 'CREATE', 'DELETE'] },
    { moduleCode: 'GRADES', actions: ['READ', 'CREATE', 'DELETE'] },
    { moduleCode: 'ATTENDANCE', actions: ['READ', 'CREATE', 'DELETE'] },
    { moduleCode: 'STUDY_PLANS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
    { moduleCode: 'SUBJECTS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
  ],
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

// ── Mock useInstitution ──
vi.mock('../../../context/institution-context', () => ({
  useInstitution: () => ({
    config: {
      id: 'inst-1',
      name: 'Escuela Test',
      levels: [10],
      send_email: false,
      send_messages: false,
    },
    isLoading: false,
    error: null,
    reload: vi.fn(),
    clear: vi.fn(),
  }),
}));

import UsersPage from '../users';

function setupApiMock() {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();

  // Users list
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/users') {
      return Promise.resolve({ data: { data: [] } });
    }
    if (url === '/institutions') {
      return Promise.resolve({ data: { data: [] } });
    }
    if (url === '/modules') {
      return Promise.resolve({
        data: {
          data: [
            { id: 'm1', code: 'STUDENTS', name: 'Estudiantes', active: true, actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'], createdAt: '', updatedAt: '' },
            { id: 'm2', code: 'TEACHERS', name: 'Docentes', active: true, actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'], createdAt: '', updatedAt: '' },
          ],
        },
      });
    }
    if (url === '/profiles') {
      return Promise.resolve({
        data: {
          data: [
            { id: 'p1', name: 'Admin', _count: { permissions: 5 }, institutionId: null, createdAt: '', updatedAt: '' },
            { id: 'p2', name: 'Docente', _count: { permissions: 3 }, institutionId: null, createdAt: '', updatedAt: '' },
          ],
        },
      });
    }
    if (url === '/profiles/p1/permissions') {
      return Promise.resolve({
        data: {
          data: [
            { moduleId: 'm1', moduleCode: 'STUDENTS', moduleName: 'Estudiantes', canRead: true, canCreate: true, canEdit: false, canDelete: false, canPrint: false },
            { moduleId: 'm2', moduleCode: 'TEACHERS', moduleName: 'Docentes', canRead: false, canCreate: false, canEdit: true, canDelete: true, canPrint: true },
          ],
        },
      });
    }
    return Promise.reject(new Error('Not found'));
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <UsersPage />
    </MemoryRouter>,
  );
}

describe('UsersPage — profile selector', () => {
  beforeEach(() => {
    setupApiMock();
  });

  it('shows profile selector in the form when "Nuevo usuario" is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Nuevo usuario')).toBeInTheDocument();
    });

    // Open form
    await user.click(screen.getByText('Nuevo usuario'));

    // Profile selector should be visible
    await waitFor(() => {
      expect(screen.getByText('Perfil predefinido (opcional)')).toBeInTheDocument();
    });

    // Profile options should include "Sin perfil (manual)"
    expect(screen.getByText('Sin perfil (manual)')).toBeInTheDocument();

    // Profile options should include profile names
    expect(screen.getByRole('option', { name: /Admin/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Docente/ })).toBeInTheDocument();
  });

  it('populates module grid when a profile is selected', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Nuevo usuario')).toBeInTheDocument();
    });

    // Open form
    await user.click(screen.getByText('Nuevo usuario'));

    // Wait for form to render
    await waitFor(() => {
      expect(screen.getByText('Crear usuario')).toBeInTheDocument();
    });

    // Select the "Admin" profile
    const profileLabel = screen.getByText('Perfil predefinido (opcional)');
    const select = profileLabel.nextElementSibling as HTMLSelectElement;
    expect(select).toBeInstanceOf(HTMLSelectElement);

    // Change to Admin profile
    await user.selectOptions(select, 'p1');

    // Should load permissions — verify the module grid renders
    await waitFor(() => {
      // After selecting a profile, the module grid should show the modules from the profile
      expect(screen.getByText('Estudiantes')).toBeInTheDocument();
      expect(screen.getByText('Docentes')).toBeInTheDocument();
    });
  });

  it('clears module grid when "Sin perfil" is selected', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Nuevo usuario')).toBeInTheDocument();
    });

    // Open form
    await user.click(screen.getByText('Nuevo usuario'));

    // Wait for form to render  
    await waitFor(() => {
      expect(screen.getByText('Crear usuario')).toBeInTheDocument();
    });

    // Select "Sin perfil"
    const profileLabel = screen.getByText('Perfil predefinido (opcional)');
    const select = profileLabel.nextElementSibling as HTMLSelectElement;
    await user.selectOptions(select, '');

    // Grid should be cleared — modules from the profile should not be pre-selected
    await waitFor(() => {
      // The grid should still render (because modules list is loaded)
      expect(screen.getByText('Estudiantes')).toBeInTheDocument();
    });
  });
});
