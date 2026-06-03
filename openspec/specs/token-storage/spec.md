# Token Storage Specification

## Purpose

Governs how the web client persists and retrieves the access token in localStorage, ensuring the key is namespaced to avoid collisions and that existing sessions survive the migration.

## Requirements

### Requirement: Namespaced Token Key

The web client MUST store the access token under the key `educandow:accessToken` in localStorage. The client MUST NOT write to the bare key `accessToken` after this change is applied. All login and logout operations MUST use the namespaced key exclusively.

#### Scenario: Login writes to namespaced key

- GIVEN a user successfully authenticates
- WHEN the client stores the received token
- THEN `localStorage.getItem('educandow:accessToken')` returns the token value
- AND `localStorage.getItem('accessToken')` is NOT set by the login flow

#### Scenario: Logout removes namespaced key

- GIVEN a user is authenticated with a token stored under `educandow:accessToken`
- WHEN the user logs out
- THEN `localStorage.removeItem` is called with `'educandow:accessToken'`
- AND the session is terminated

### Requirement: One-Time Migration Fallback

On first token read after deployment, if `educandow:accessToken` is absent but `accessToken` is present, the client MUST transparently migrate: read the value from `accessToken`, write it to `educandow:accessToken`, and remove `accessToken`. Subsequent reads MUST use only `educandow:accessToken`.

#### Scenario: Existing session migrated on first read

- GIVEN a user has a token stored under the bare key `accessToken`
- AND no value exists under `educandow:accessToken`
- WHEN the client reads the token (e.g., on app load or API call)
- THEN the token is read from `accessToken`
- AND written to `educandow:accessToken`
- AND `accessToken` is removed from localStorage
- AND the user remains authenticated without being logged out

#### Scenario: No migration when namespaced key already exists

- GIVEN a token is already stored under `educandow:accessToken`
- WHEN the client reads the token
- THEN no read from `accessToken` is performed
- AND localStorage is not modified beyond the read

#### Scenario: No migration when neither key exists

- GIVEN localStorage contains no token under either key
- WHEN the client reads the token
- THEN the client returns `null` (unauthenticated)
- AND no write to localStorage occurs
