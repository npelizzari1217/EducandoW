import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTheme } from '../use-theme';

// Mock InstitutionContext to control institution config values
const mockConfig = {
  header_color: null as string | null,
  header_text_color: null as string | null,
  body_text_color: null as string | null,
};

vi.mock('../../context/institution-context', () => ({
  useInstitution: () => ({
    config: mockConfig,
  }),
}));

// Spy on document.documentElement.style.setProperty and removeProperty
const setPropertySpy = vi.fn();
const removePropertySpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mock config to defaults
  mockConfig.header_color = null;
  mockConfig.header_text_color = null;
  mockConfig.body_text_color = null;
  // Spy on style methods
  Object.defineProperty(document, 'documentElement', {
    value: {
      style: {
        setProperty: setPropertySpy,
        removeProperty: removePropertySpy,
      },
    },
    writable: true,
    configurable: true,
  });
});

describe('useTheme', () => {
  it('applies --color-primary and --color-header from header_color', () => {
    mockConfig.header_color = '#1a56db';

    renderHook(() => useTheme());

    expect(setPropertySpy).toHaveBeenCalledWith('--color-primary', '#1a56db');
    expect(setPropertySpy).toHaveBeenCalledWith('--color-header', '#1a56db');
  });

  it('applies --color-header-text from header_text_color', () => {
    mockConfig.header_text_color = '#ffffff';

    renderHook(() => useTheme());

    expect(setPropertySpy).toHaveBeenCalledWith('--color-header-text', '#ffffff');
  });

  it('applies --color-body-text from body_text_color', () => {
    mockConfig.body_text_color = '#333333';

    renderHook(() => useTheme());

    expect(setPropertySpy).toHaveBeenCalledWith('--color-body-text', '#333333');
  });

  it('applies all three color variables simultaneously', () => {
    mockConfig.header_color = '#ff0000';
    mockConfig.header_text_color = '#00ff00';
    mockConfig.body_text_color = '#0000ff';

    renderHook(() => useTheme());

    expect(setPropertySpy).toHaveBeenCalledWith('--color-primary', '#ff0000');
    expect(setPropertySpy).toHaveBeenCalledWith('--color-header', '#ff0000');
    expect(setPropertySpy).toHaveBeenCalledWith('--color-header-text', '#00ff00');
    expect(setPropertySpy).toHaveBeenCalledWith('--color-body-text', '#0000ff');
  });

  it('does NOT apply header_color variables when header_color is null', () => {
    mockConfig.header_color = null;

    renderHook(() => useTheme());

    expect(setPropertySpy).not.toHaveBeenCalledWith('--color-primary', expect.anything());
    expect(setPropertySpy).not.toHaveBeenCalledWith('--color-header', expect.anything());
  });

  it('does NOT apply header_text_color when it is null', () => {
    mockConfig.header_text_color = null;

    renderHook(() => useTheme());

    expect(setPropertySpy).not.toHaveBeenCalledWith('--color-header-text', expect.anything());
  });

  it('does NOT apply body_text_color when it is null', () => {
    mockConfig.body_text_color = null;

    renderHook(() => useTheme());

    expect(setPropertySpy).not.toHaveBeenCalledWith('--color-body-text', expect.anything());
  });

  it('cleans up CSS variables on unmount by removing them', () => {
    mockConfig.header_color = '#abcdef';
    mockConfig.header_text_color = '#123456';
    mockConfig.body_text_color = '#654321';

    const { unmount } = renderHook(() => useTheme());

    unmount();

    expect(removePropertySpy).toHaveBeenCalledWith('--color-primary');
    expect(removePropertySpy).toHaveBeenCalledWith('--color-header');
    expect(removePropertySpy).toHaveBeenCalledWith('--color-header-text');
    expect(removePropertySpy).toHaveBeenCalledWith('--color-body-text');
  });

  it('updates CSS variables when context config changes', () => {
    mockConfig.header_color = '#111111';

    const { rerender } = renderHook(() => useTheme());

    expect(setPropertySpy).toHaveBeenCalledWith('--color-primary', '#111111');

    setPropertySpy.mockClear();
    mockConfig.header_color = '#222222';

    rerender();

    expect(setPropertySpy).toHaveBeenCalledWith('--color-primary', '#222222');
    expect(setPropertySpy).toHaveBeenCalledWith('--color-header', '#222222');
  });
});
