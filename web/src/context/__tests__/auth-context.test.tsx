import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../auth-context';

// Mock apiClient
vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// Mock sessionManager
const mockResolveRelogin = vi.fn();
const mockRejectRelogin = vi.fn();
const mockIsPending = { value: false };

vi.mock('../../api/session-manager', () => ({
  sessionManager: {
    resolveRelogin: () => mockResolveRelogin(),
    rejectRelogin: (...args: unknown[]) => mockRejectRelogin(...args),
    get isPending() { return mockIsPending.value; },
  },
}));

const apiClient = (await import('../../api/client')).default;

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const MOCK_USER = { id: 'u1', email: 'test@example.com', name: 'Test User', role: 'ADMIN' };
const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.mock';

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockIsPending.value = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with active sessionStatus', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.sessionStatus).toBe('active');
  });

  it('sets sessionStatus to expired when auth:session-expired event fires', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    });

    expect(result.current.sessionStatus).toBe('expired');
  });

  it('reauthenticate calls login with user email and resolves session manager', async () => {
    localStorage.setItem('user', JSON.stringify(MOCK_USER));
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { accessToken: MOCK_TOKEN, user: MOCK_USER } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // First expire the session
    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    });
    expect(result.current.sessionStatus).toBe('expired');

    // Then reauthenticate
    await act(async () => {
      await result.current.reauthenticate('mypassword');
    });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
      email: MOCK_USER.email,
      password: 'mypassword',
    });
    expect(result.current.sessionStatus).toBe('active');
    expect(mockResolveRelogin).toHaveBeenCalledTimes(1);
  });

  it('logout resets sessionStatus to active and calls rejectRelogin if pending', async () => {
    mockIsPending.value = true;
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    });
    expect(result.current.sessionStatus).toBe('expired');

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.sessionStatus).toBe('active');
    expect(mockRejectRelogin).toHaveBeenCalled();
  });

  it('login dispatches auth:login event', async () => {
    const handler = vi.fn();
    window.addEventListener('auth:login', handler);

    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { accessToken: MOCK_TOKEN, user: MOCK_USER } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'pass');
    });

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:login', handler);
  });
});
