import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('educandow-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const applyTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('educandow-theme', t);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const toggle = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/**
 * Read institution branding colors from CSS custom properties set on :root.
 * Returns null for each color if the variable is not set.
 * This is intended for programmatic access — components should prefer
 * `var(--header-color)` via CSS for automatic reactivity.
 */
export function getInstitutionColors() {
  if (typeof document === 'undefined') return {};
  const root = document.documentElement;
  const get = (name: string): string | null => {
    const val = root.style.getPropertyValue(name);
    return val || null;
  };
  return {
    headerColor: get('--header-color'),
    headerTextColor: get('--header-text-color'),
    bodyTextColor: get('--body-text-color'),
    bodyBgColor: get('--body-bg-color'),
    footerColor: get('--footer-color'),
    footerTextColor: get('--footer-text-color'),
  };
}
