import { useTheme } from '../../hooks/use-theme';

/**
 * Internal component that invokes useTheme() to apply CSS variables
 * globally on document.documentElement. Renders nothing.
 *
 * Must be mounted inside InstitutionProvider so it has access to institution config.
 */
export function ThemeApplier(): null {
  useTheme();
  return null;
}
