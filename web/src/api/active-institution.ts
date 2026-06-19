/**
 * Active institution store — synchronous localStorage module.
 *
 * Key: `educandow:activeInstitutionId`
 *
 * Mirrors the token.ts pattern: synchronous reads so the axios interceptor can
 * consume the value outside React (no hooks, no async).
 *
 * Only ROOT users ever write to this store; non-ROOT users have a tenant
 * resolved server-side from their JWT, so this value stays null for them.
 */

import type { InternalAxiosRequestConfig } from 'axios';

const KEY = 'educandow:activeInstitutionId';

/** Returns the currently active institution id, or null if none is stored. */
export function getActiveInstitutionId(): string | null {
  return localStorage.getItem(KEY);
}

/** Persists the active institution id. */
export function setActiveInstitutionId(id: string): void {
  localStorage.setItem(KEY, id);
}

/** Clears the active institution id from localStorage. */
export function clearActiveInstitutionId(): void {
  localStorage.removeItem(KEY);
}

/**
 * Injects the active institution id into the axios request config.
 *
 * Rules (ADR-4):
 * - Only injects when `config.params.institutionId` is null or undefined (nullish).
 * - An explicit empty string `''` (deliberate "Todas") is preserved unchanged.
 * - When no active institution is stored, the config is returned unmodified.
 *
 * This is a PURE helper: it reads the synchronous module store and returns the
 * mutated config. It is called from the request interceptor in client.ts, which
 * runs OUTSIDE React — never call hooks here.
 */
export function applyActiveInstitution(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  const activeId = getActiveInstitutionId();
  if (!activeId) return config;

  const params = config.params as Record<string, unknown> | undefined;
  const existing = params?.institutionId;

  // Only inject when param is truly absent (null or undefined, NOT explicit '')
  if (existing == null) {
    config.params = { ...params, institutionId: activeId };
  }

  return config;
}
