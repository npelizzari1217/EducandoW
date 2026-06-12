import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import apiClient from '../api/client';
import { getToken, setToken, removeToken } from '../api/token';
import { sessionManager } from '../api/session-manager';

interface User {
  id: string; email: string; name: string; role: string;
  roles?: string[]; institutionId?: string; levels?: number[];
  userLevels?: { level: number; modality: number }[];
  modules?: { moduleCode: string; actions: string[] }[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  sessionStatus: 'active' | 'expired';
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; role?: string; institutionId?: string }) => Promise<void>;
  logout: () => Promise<void>;
  reauthenticate: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [accessToken, setAccessToken] = useState<string | null>(() => getToken());
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'active' | 'expired'>('active');

  // Listen for session-expired events from the interceptor / idle timer
  useEffect(() => {
    const handleExpired = () => setSessionStatus('expired');
    window.addEventListener('auth:session-expired', handleExpired);
    return () => window.removeEventListener('auth:session-expired', handleExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      const token = data.data.accessToken;
      const u = data.data.user;
      setToken(token);
      localStorage.setItem('user', JSON.stringify(u));
      setAccessToken(token);
      setUser(u);
      // Notify other contexts (e.g. InstitutionContext) that login succeeded
      window.dispatchEvent(new CustomEvent('auth:login'));
    } finally { setIsLoading(false); }
  }, []);

  const register = useCallback(async (input: { email: string; password: string; name: string; role?: string; institutionId?: string }) => {
    setIsLoading(true);
    try {
      await apiClient.post('/auth/register', input);
    } finally { setIsLoading(false); }
  }, []);

  const logout = useCallback(async () => {
    // If a re-login is pending, cancel it before logging out
    if (sessionManager.isPending) {
      sessionManager.rejectRelogin(new Error('Logged out'));
    }
    try { await apiClient.post('/auth/logout'); } catch { /* ignore */ }
    removeToken();
    localStorage.removeItem('user');
    setAccessToken(null);
    setUser(null);
    setSessionStatus('active');
    // Notify other contexts that logout happened
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }, []);

  /** Re-authenticate the SAME user (email pre-filled) using only the password. */
  const reauthenticate = useCallback(async (password: string) => {
    if (!user?.email) throw new Error('No user email available');
    // Use login endpoint — same user, new token
    const { data } = await apiClient.post('/auth/login', { email: user.email, password });
    const token = data.data.accessToken;
    const u = data.data.user;
    setToken(token);
    localStorage.setItem('user', JSON.stringify(u));
    setAccessToken(token);
    setUser(u);
    setSessionStatus('active');
    sessionManager.resolveRelogin(); // unblock queued requests
    window.dispatchEvent(new CustomEvent('auth:login'));
  }, [user?.email]);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, sessionStatus, login, register, logout, reauthenticate }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
