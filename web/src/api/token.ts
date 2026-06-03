/**
 * Token storage with namespaced key and transparent migration.
 *
 * Key: `educandow:accessToken`
 *
 * Migration: on read, if `educandow:accessToken` is absent but the bare key
 * `accessToken` exists, the value is migrated transparently (read from old,
 * write to new, remove old). This prevents logging out existing sessions on
 * deploy. The migration is idempotent — calling it multiple times is safe.
 *
 * All writes use the namespaced key exclusively.
 */

const NEW_KEY = 'educandow:accessToken';
const OLD_KEY = 'accessToken';

/**
 * Reads the access token from localStorage.
 * Transparently migrates from the old bare key when found.
 */
export function getToken(): string | null {
  const token = localStorage.getItem(NEW_KEY);
  if (token !== null) return token;

  // Migration fallback
  const legacy = localStorage.getItem(OLD_KEY);
  if (legacy !== null) {
    localStorage.setItem(NEW_KEY, legacy);
    localStorage.removeItem(OLD_KEY);
    return legacy;
  }

  return null;
}

/**
 * Stores the access token under the namespaced key.
 * Also removes the old key to clean up any residual values.
 */
export function setToken(token: string): void {
  localStorage.setItem(NEW_KEY, token);
  localStorage.removeItem(OLD_KEY);
}

/**
 * Removes the access token from both keys.
 */
export function removeToken(): void {
  localStorage.removeItem(NEW_KEY);
  localStorage.removeItem(OLD_KEY);
}
