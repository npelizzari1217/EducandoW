import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  ActiveInstitutionProvider,
  useActiveInstitution,
} from '../active-institution-context';

const KEY = 'educandow:activeInstitutionId';

// jsdom does not allow vi.spyOn(window.location, 'reload') because the
// property is non-configurable. Replace the whole location object so we can
// mock reload safely.
const reloadMock = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: reloadMock },
  configurable: true,
  writable: true,
});

function wrapper({ children }: { children: ReactNode }) {
  return <ActiveInstitutionProvider>{children}</ActiveInstitutionProvider>;
}

describe('ActiveInstitutionContext', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadMock.mockClear();
  });;

  it('lazy-inits activeId from localStorage on mount', () => {
    localStorage.setItem(KEY, 'inst-stored');
    const { result } = renderHook(() => useActiveInstitution(), { wrapper });
    expect(result.current.activeId).toBe('inst-stored');
  });

  it('setActive writes through to localStorage and updates state', async () => {
    const { result } = renderHook(() => useActiveInstitution(), { wrapper });

    await act(async () => {
      result.current.setActive('inst-new');
    });

    expect(localStorage.getItem(KEY)).toBe('inst-new');
    // reload is called, so state update happens before reload
    expect(result.current.activeId).toBe('inst-new');
  });

  it('setActive triggers window.location.reload()', async () => {
    const { result } = renderHook(() => useActiveInstitution(), { wrapper });

    await act(async () => {
      result.current.setActive('inst-reload');
    });

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('clear() removes from localStorage and sets activeId to null without reload', async () => {
    localStorage.setItem(KEY, 'inst-to-clear');
    const { result } = renderHook(() => useActiveInstitution(), { wrapper });
    expect(result.current.activeId).toBe('inst-to-clear');

    await act(async () => {
      result.current.clear();
    });

    expect(result.current.activeId).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('auth:logout event clears activeId and removes from localStorage', async () => {
    localStorage.setItem(KEY, 'inst-before-logout');
    const { result } = renderHook(() => useActiveInstitution(), { wrapper });
    expect(result.current.activeId).toBe('inst-before-logout');

    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    });

    expect(result.current.activeId).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
