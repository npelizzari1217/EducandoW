import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import apiClient from '../api/client';

interface User { id: string; email: string; name: string; role: string; institutionId?: string; level?: string; }
interface AuthState { user: User | null; accessToken: string | null; isLoading: boolean; login: (email: string, password: string) => Promise<void>; register: (data: { email: string; password: string; name: string; role?: string; institutionId?: string }) => Promise<void>; logout: () => Promise<void>; }

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('accessToken'));
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      const token = data.data.accessToken;
      const u = data.data.user;
      localStorage.setItem('accessToken', token);
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
    try { await apiClient.post('/auth/logout'); } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setAccessToken(null);
    setUser(null);
    // Notify other contexts that logout happened
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }, []);

  return <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
