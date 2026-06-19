import { describe, it, expect, beforeEach } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import {
  getActiveInstitutionId,
  setActiveInstitutionId,
  clearActiveInstitutionId,
  applyActiveInstitution,
} from '../active-institution';

const KEY = 'educandow:activeInstitutionId';

describe('active-institution store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getActiveInstitutionId returns null when key is absent', () => {
    expect(getActiveInstitutionId()).toBeNull();
  });

  it('setActiveInstitutionId persists and getActiveInstitutionId returns the value', () => {
    setActiveInstitutionId('inst-42');
    expect(localStorage.getItem(KEY)).toBe('inst-42');
    expect(getActiveInstitutionId()).toBe('inst-42');
  });

  it('clearActiveInstitutionId removes the value from localStorage', () => {
    localStorage.setItem(KEY, 'inst-42');
    clearActiveInstitutionId();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(getActiveInstitutionId()).toBeNull();
  });
});

// Helper to build a minimal InternalAxiosRequestConfig for tests
function makeConfig(params?: Record<string, unknown>): InternalAxiosRequestConfig {
  return { params } as InternalAxiosRequestConfig;
}

describe('applyActiveInstitution', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('injects activeInstitutionId when params.institutionId is absent and store has a value', () => {
    setActiveInstitutionId('inst-99');
    const config = makeConfig({});
    const result = applyActiveInstitution(config);
    expect((result.params as Record<string, unknown>).institutionId).toBe('inst-99');
  });

  it('preserves an explicit institutionId even when store has a value', () => {
    setActiveInstitutionId('inst-99');
    const config = makeConfig({ institutionId: 'explicit-id' });
    const result = applyActiveInstitution(config);
    expect((result.params as Record<string, unknown>).institutionId).toBe('explicit-id');
  });

  it("preserves explicit '' (deliberate 'Todas') even when store has a value", () => {
    setActiveInstitutionId('inst-99');
    const config = makeConfig({ institutionId: '' });
    const result = applyActiveInstitution(config);
    expect((result.params as Record<string, unknown>).institutionId).toBe('');
  });

  it('is a no-op when the store is empty', () => {
    const config = makeConfig({});
    const result = applyActiveInstitution(config);
    expect((result.params as Record<string, unknown>).institutionId).toBeUndefined();
  });
});
