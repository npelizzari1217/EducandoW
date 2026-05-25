import { useTheme } from '../../context/theme-context';
import './theme-toggle.css';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === 'light' ? 'Cambiar a modo noche' : 'Cambiar a modo día'}
      title={theme === 'light' ? 'Modo noche' : 'Modo día'}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
