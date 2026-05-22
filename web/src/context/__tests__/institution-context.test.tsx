import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { InstitutionProvider, useInstitution } from '../institution-context';
import type { ReactNode } from 'react';
import axios from 'axios';

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

const apiClient = (await import('../../api/client')).default;

const mockInstitutionData = {
  id: 'inst-001',
  name: 'Escuela Test',
  cue: 'ABC123',
  ministry_reg: 'MIN-001',
  address: 'Calle Falsa 123',
  city: 'Buenos Aires',
  postal_code: 'C1425',
  country: 'AR',
  phone: '5411123456',
  website: 'https://escuela.edu.ar',
  contact_email: 'info@escuela.edu.ar',
  logo_url: 'https://cdn.example.com/logo.png',
  header_color: '#1a56db',
  header_text_color: '#ffffff',
  body_text_color: '#333333',
  smtp_host: 'smtp.gmail.com',
  smtp_user: 'notifications@school.edu',
  smtp_encryption: 'TLS',
  smtp_port: 587,
  send_email: true,
  send_messages: false,
  socket_host: 'ws.school.edu',
  socket_port: 8080,
  active: true,
  db_name: 'educandow_inst-001',
  levels: ['INICIAL', 'PRIMARIO'],
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-02T00:00:00.000Z',
};

function wrapper({ children }: { children: ReactNode }) {
  return <InstitutionProvider>{children}</InstitutionProvider>;
}

describe('InstitutionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads institution data when token exists', async () => {
    localStorage.setItem('accessToken', 'fake-token');
    (apiClient.get as any).mockResolvedValue({ data: { data: mockInstitutionData } });

    const { result } = renderHook(() => useInstitution(), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.config.name).toBe('Escuela Test');
    expect(result.current.config.header_color).toBe('#1a56db');
    expect(result.current.config.levels).toEqual(['INICIAL', 'PRIMARIO']);
    expect(result.current.config.send_email).toBe(true);
    expect(apiClient.get).toHaveBeenCalledWith('/institutions/me');
  });

  it('falls back to defaults when fetch fails', async () => {
    localStorage.setItem('accessToken', 'fake-token');
    (apiClient.get as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useInstitution(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.config.name).toBe('');
    expect(result.current.config.levels).toEqual([]);
    expect(result.current.config.send_email).toBe(false);
    expect(result.current.config.send_messages).toBe(false);
    expect(result.current.config.active).toBe(true);
    expect(result.current.error).toBeTruthy();
  });

  it('does not crash when token is absent (no fetch)', async () => {
    (apiClient.get as any).mockResolvedValue({ data: { data: mockInstitutionData } });

    const { result } = renderHook(() => useInstitution(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should not have called the API since no token
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(result.current.config.name).toBe('');
    expect(result.current.config.levels).toEqual([]);
  });

  it('reloads when auth:login event is dispatched', async () => {
    localStorage.setItem('accessToken', 'fake-token');
    (apiClient.get as any).mockResolvedValue({ data: { data: mockInstitutionData } });

    const { result } = renderHook(() => useInstitution(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Change mock data for next call
    const updatedData = { ...mockInstitutionData, name: 'Escuela Actualizada' };
    (apiClient.get as any).mockResolvedValue({ data: { data: updatedData } });

    // Simulate login event
    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:login'));
    });

    await waitFor(() => {
      expect(result.current.config.name).toBe('Escuela Actualizada');
    });
  });

  it('clears config on auth:logout event', async () => {
    localStorage.setItem('accessToken', 'fake-token');
    (apiClient.get as any).mockResolvedValue({ data: { data: mockInstitutionData } });

    const { result } = renderHook(() => useInstitution(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.config.name).toBe('Escuela Test');

    // Simulate logout
    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    });

    expect(result.current.config.name).toBe('');
    expect(result.current.config.levels).toEqual([]);
    expect(result.current.config.active).toBe(true);
  });

  it('exposes all config fields from API response', async () => {
    localStorage.setItem('accessToken', 'fake-token');
    (apiClient.get as any).mockResolvedValue({ data: { data: mockInstitutionData } });

    const { result } = renderHook(() => useInstitution(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const c = result.current.config;
    expect(c.id).toBe('inst-001');
    expect(c.cue).toBe('ABC123');
    expect(c.ministry_reg).toBe('MIN-001');
    expect(c.address).toBe('Calle Falsa 123');
    expect(c.city).toBe('Buenos Aires');
    expect(c.postal_code).toBe('C1425');
    expect(c.country).toBe('AR');
    expect(c.phone).toBe('5411123456');
    expect(c.website).toBe('https://escuela.edu.ar');
    expect(c.contact_email).toBe('info@escuela.edu.ar');
    expect(c.logo_url).toBe('https://cdn.example.com/logo.png');
    expect(c.header_color).toBe('#1a56db');
    expect(c.header_text_color).toBe('#ffffff');
    expect(c.body_text_color).toBe('#333333');
    expect(c.smtp_host).toBe('smtp.gmail.com');
    expect(c.smtp_user).toBe('notifications@school.edu');
    expect(c.smtp_encryption).toBe('TLS');
    expect(c.smtp_port).toBe(587);
    expect(c.send_email).toBe(true);
    expect(c.send_messages).toBe(false);
    expect(c.socket_host).toBe('ws.school.edu');
    expect(c.socket_port).toBe(8080);
    expect(c.active).toBe(true);
    expect(c.db_name).toBe('educandow_inst-001');
    expect(c.levels).toEqual(['INICIAL', 'PRIMARIO']);
    expect(c.created_at).toBeTruthy();
    expect(c.updated_at).toBeTruthy();
  });
});
