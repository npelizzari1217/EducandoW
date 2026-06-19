import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  getActiveInstitutionId,
  setActiveInstitutionId,
  clearActiveInstitutionId,
} from '../api/active-institution';

interface ActiveInstitutionState {
  /** Currently selected institution id, or null when none is selected. */
  activeId: string | null;
  /**
   * Selects an institution: persists to localStorage, updates state, then
   * reloads the page so all tenant-scoped queries re-run with the new param.
   * (MVP: reload strategy; query-invalidation is deferred.)
   */
  setActive: (id: string) => void;
  /**
   * Clears the active institution: removes from localStorage and sets state
   * to null. No reload — the tenant guard re-renders reactively to show the
   * selection prompt.
   */
  clear: () => void;
}

const ActiveInstitutionContext = createContext<ActiveInstitutionState | null>(null);

export function ActiveInstitutionProvider({ children }: { children: ReactNode }) {
  // Lazy init from localStorage — value is present on first render, before any
  // request fires, so the interceptor gets the right id on first page load.
  const [activeId, setActiveId] = useState<string | null>(() => getActiveInstitutionId());

  // Clear on logout so a stale ROOT selection never leaks to the next session.
  useEffect(() => {
    const handleLogout = () => {
      clearActiveInstitutionId();
      setActiveId(null);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const setActive = useCallback((id: string) => {
    setActiveInstitutionId(id);
    setActiveId(id);
    window.location.reload();
  }, []);

  const clear = useCallback(() => {
    clearActiveInstitutionId();
    setActiveId(null);
  }, []);

  return (
    <ActiveInstitutionContext.Provider value={{ activeId, setActive, clear }}>
      {children}
    </ActiveInstitutionContext.Provider>
  );
}

export function useActiveInstitution(): ActiveInstitutionState {
  const ctx = useContext(ActiveInstitutionContext);
  if (!ctx) throw new Error('useActiveInstitution must be used within ActiveInstitutionProvider');
  return ctx;
}
