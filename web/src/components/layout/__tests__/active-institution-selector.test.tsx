import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActiveInstitutionSelector } from '../active-institution-selector';

// Mock apiClient
vi.mock('../../../api/client', () => ({
  default: { get: vi.fn() },
}));

// Mock useActiveInstitution
const mockSetActive = vi.fn();
const mockClear = vi.fn();
let mockActiveId: string | null = null;

vi.mock('../../../context/active-institution-context', () => ({
  useActiveInstitution: () => ({ activeId: mockActiveId, setActive: mockSetActive, clear: mockClear }),
}));

// Mock useAuth — configurable per test
let mockRoles: string[] = ['ADMIN'];

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({ user: { roles: mockRoles } }),
}));

import apiClient from '../../../api/client';

const INSTITUTIONS = [
  { id: 'inst-1', name: 'Escuela Alfa' },
  { id: 'inst-2', name: 'Escuela Beta' },
];

describe('ActiveInstitutionSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveId = null;
    mockRoles = ['ADMIN'];
  });

  it('returns null (renders nothing) for non-ROOT users', () => {
    mockRoles = ['ADMIN'];
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: INSTITUTIONS } });

    const { container } = render(<ActiveInstitutionSelector />);
    expect(container.firstChild).toBeNull();
  });

  it('ROOT with no active institution shows placeholder option', async () => {
    mockRoles = ['ROOT'];
    mockActiveId = null;
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: INSTITUTIONS } });

    render(<ActiveInstitutionSelector />);

    await waitFor(() => {
      expect(screen.getByText('Seleccionar institución')).toBeInTheDocument();
    });
  });

  it('ROOT renders institution options from GET /institutions', async () => {
    mockRoles = ['ROOT'];
    mockActiveId = null;
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: INSTITUTIONS } });

    render(<ActiveInstitutionSelector />);

    await waitFor(() => {
      expect(screen.getByText('Escuela Alfa')).toBeInTheDocument();
      expect(screen.getByText('Escuela Beta')).toBeInTheDocument();
    });
  });

  it('onChange calls setActive with the selected institution id', async () => {
    mockRoles = ['ROOT'];
    mockActiveId = null;
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: INSTITUTIONS } });

    render(<ActiveInstitutionSelector />);

    // Wait for options to appear
    await waitFor(() => {
      expect(screen.getByText('Escuela Alfa')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'inst-1');

    expect(mockSetActive).toHaveBeenCalledWith('inst-1');
  });

  it('onChange with empty/placeholder value calls clear (deselect)', async () => {
    mockRoles = ['ROOT'];
    mockActiveId = 'inst-1'; // starts with an active selection
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: INSTITUTIONS } });

    render(<ActiveInstitutionSelector />);

    await waitFor(() => {
      expect(screen.getByText('Escuela Alfa')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    // Select the placeholder (empty value) to deselect
    await userEvent.selectOptions(select, '');

    expect(mockClear).toHaveBeenCalledTimes(1);
    expect(mockSetActive).not.toHaveBeenCalled();
  });
});
