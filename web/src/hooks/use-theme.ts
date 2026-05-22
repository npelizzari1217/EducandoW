import { useEffect } from 'react';
import { useInstitution } from '../context/institution-context';

/**
 * Applies institution branding CSS variables to :root.
 *
 * Reads header_color, header_text_color, and body_text_color from
 * InstitutionContext and sets them as CSS custom properties on
 * document.documentElement. Cleans up on unmount.
 *
 * CSS variables set:
 *   --color-primary      (from header_color)
 *   --color-header       (from header_color)
 *   --color-header-text  (from header_text_color)
 *   --color-body-text    (from body_text_color)
 *
 * When a color is null, the variable is not set (design-system default applies).
 */
export function useTheme(): void {
  const { config } = useInstitution();

  useEffect(() => {
    const root = document.documentElement;
    const { header_color, header_text_color, body_text_color } = config;

    if (header_color) {
      root.style.setProperty('--color-primary', header_color);
      root.style.setProperty('--color-header', header_color);
    }
    if (header_text_color) {
      root.style.setProperty('--color-header-text', header_text_color);
    }
    if (body_text_color) {
      root.style.setProperty('--color-body-text', body_text_color);
    }

    return () => {
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-header');
      root.style.removeProperty('--color-header-text');
      root.style.removeProperty('--color-body-text');
    };
  }, [config.header_color, config.header_text_color, config.body_text_color]);
}
