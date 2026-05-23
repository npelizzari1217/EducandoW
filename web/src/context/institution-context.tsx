import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import apiClient from '../api/client';

export interface InstitutionConfig {
  id: string;
  name: string;
  cue: string | null;
  ministry_reg: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  website: string | null;
  contact_email: string | null;
  logo_url: string | null;
  header_color: string | null;
  header_text_color: string | null;
  body_text_color: string | null;
  smtp_host: string | null;
  smtp_user: string | null;
  smtp_encryption: string | null;
  smtp_port: number | null;
  send_email: boolean;
  send_messages: boolean;
  socket_host: string | null;
  socket_port: number | null;
  active: boolean;
  db_name: string | null;
  levels: number[];
  created_at: string | null;
  updated_at: string | null;
}

const DEFAULT_CONFIG: InstitutionConfig = {
  id: '',
  name: '',
  cue: null,
  ministry_reg: null,
  address: null,
  city: null,
  postal_code: null,
  country: 'AR',
  phone: null,
  website: null,
  contact_email: null,
  logo_url: null,
  header_color: null,
  header_text_color: null,
  body_text_color: null,
  smtp_host: null,
  smtp_user: null,
  smtp_encryption: null,
  smtp_port: null,
  send_email: false,
  send_messages: false,
  socket_host: null,
  socket_port: null,
  active: true,
  db_name: null,
  levels: [],
  created_at: null,
  updated_at: null,
};

interface InstitutionState {
  config: InstitutionConfig;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  clear: () => void;
}

const InstitutionContext = createContext<InstitutionState | null>(null);

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<InstitutionConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get('/institutions/me');
      setConfig(data.data as InstitutionConfig);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al cargar configuración institucional');
      // Fallback to defaults — don't crash
      setConfig(DEFAULT_CONFIG);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    setError(null);
  }, []);

  // Auto-fetch on mount when token exists
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Listen for auth login/logout events
  useEffect(() => {
    const handleLogin = () => { fetchConfig(); };
    const handleLogout = () => { clear(); };
    window.addEventListener('auth:login', handleLogin);
    window.addEventListener('auth:logout', handleLogout);
    return () => {
      window.removeEventListener('auth:login', handleLogin);
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, [fetchConfig, clear]);

  return (
    <InstitutionContext.Provider value={{ config, isLoading, error, reload: fetchConfig, clear }}>
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution() {
  const ctx = useContext(InstitutionContext);
  if (!ctx) throw new Error('useInstitution must be used within InstitutionProvider');
  return ctx;
}
