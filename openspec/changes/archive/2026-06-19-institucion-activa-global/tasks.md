# Tasks — Institución Activa Global (ROOT)

> Phase: tasks. Artifact store: hybrid (engram + openspec).
> Scope: web-only. 13 tasks. Strict TDD active (`pnpm test`, coverage ≥ 80%).
> Pure units (store + applyActiveInstitution) are written test-first per design §6.

---

## Dependency Graph

```
T-01 → T-02 → T-03 → T-04 → T-05
                ↘              (interceptor wiring — independent of context track)
              T-06 → T-07 → T-08 → T-09
                         ↘
                         T-10 → T-11 → T-12
                                          ↓
                                         T-13
```

Parallel opportunity after T-04: **T-05** and **T-06** are unblocked simultaneously (T-05 needs T-04; T-06 needs T-02, which T-04 also needed). A single developer follows the sequential order below; a two-agent apply could run T-05 and T-06 in parallel.

Recommended single-dev apply order: T-01 → T-02 → T-03 → T-04 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10 → T-11 → T-12 → T-13.

---

## Tasks

### T-01 — Write store unit tests (RED)

- **File (NEW):** `web/src/api/__tests__/active-institution.test.ts`
- **Spec:** REQ-01 (localStorage persistence, namespaced key, null when unset)
- **Test cases:**
  1. `getActiveInstitutionId()` returns `null` when localStorage is empty
  2. `setActiveInstitutionId('inst-1')` then `getActiveInstitutionId()` returns `'inst-1'`
  3. `setActiveInstitutionId` + `clearActiveInstitutionId()` → `getActiveInstitutionId()` returns `null`; raw localStorage key `educandow:activeInstitutionId` is gone
- **Setup:** `beforeEach(() => localStorage.clear())`
- **Status when written:** RED (module does not exist yet)
- **Dependencies:** none

---

### T-02 — Implement store module (GREEN for T-01)

- **File (NEW):** `web/src/api/active-institution.ts`
- **Spec:** REQ-01
- **Exports:**
  ```ts
  const KEY = 'educandow:activeInstitutionId';
  export function getActiveInstitutionId(): string | null
  export function setActiveInstitutionId(id: string): void
  export function clearActiveInstitutionId(): void
  ```
- Mirror the structure of `token.ts` (plain synchronous localStorage functions, namespaced key, JSDoc comment block).
- **Dependencies:** T-01 (tests must be written first)

---

### T-03 — Write applyActiveInstitution unit tests (RED)

- **File (EXTEND):** `web/src/api/__tests__/active-institution.test.ts`
- **Spec:** REQ-03 (interceptor injection), REQ-05 (non-ROOT no-op), REQ-06 (explicit call-site precedence)
- **Test cases (exactly 4, from design §6):**
  1. `activeId` set, `config.params` absent → `config.params.institutionId` set to `activeId` (injected)
  2. `activeId` set, `config.params.institutionId = 'inst-explicit'` → value preserved (call-site wins)
  3. `activeId` set, `config.params.institutionId = ''` → empty string preserved (deliberate "Todas")
  4. store empty (no `activeId`) → config returned unchanged; no `params` key added
- **Note:** `config` in tests is a plain object typed as `InternalAxiosRequestConfig` — no real axios instance needed.
- **Dependencies:** T-02 (import must resolve; store functions used to set up fixture state)

---

### T-04 — Implement applyActiveInstitution helper (GREEN for T-03)

- **File (EXTEND):** `web/src/api/active-institution.ts`
- **Spec:** REQ-03, REQ-05, REQ-06
- **Signature:**
  ```ts
  import type { InternalAxiosRequestConfig } from 'axios';

  export function applyActiveInstitution(
    config: InternalAxiosRequestConfig,
  ): InternalAxiosRequestConfig
  ```
- **Logic:** if `getActiveInstitutionId()` is null → return config unchanged. Otherwise `config.params ??= {}` then inject only if `config.params.institutionId == null` (nullish, preserves explicit `''`).
- **Dependencies:** T-03

---

### T-05 — Wire interceptor in client.ts

- **File (MODIFY):** `web/src/api/client.ts`
- **Spec:** REQ-03
- **Change (2 lines):**
  - Add import: `import { applyActiveInstitution } from './active-institution';`
  - In existing `apiClient.interceptors.request.use` callback, change the final `return config` to `return applyActiveInstitution(config);`
- No new interceptor. No per-route branching. The one-line change is the full delta.
- **Verify:** existing interceptor tests (if any) still pass; `pnpm test` green.
- **Dependencies:** T-04

---

### T-06 — Write context unit tests (RED)

- **File (NEW):** `web/src/context/__tests__/active-institution-context.test.tsx`
- **Spec:** REQ-01 (reactive state, persistence), REQ-04 (logout clears stale selection)
- **Test cases:**
  1. **Lazy init:** set `localStorage.setItem('educandow:activeInstitutionId', 'inst-42')` before render → `useActiveInstitution().activeId` equals `'inst-42'` on mount
  2. **Write-through:** call `setActive('inst-99')` via `act(...)` → `localStorage.getItem('educandow:activeInstitutionId')` equals `'inst-99'` AND `activeId` state equals `'inst-99'`
  3. **Reload on setActive:** stub `vi.spyOn(window.location, 'reload').mockImplementation(() => {})` before render → after `setActive(...)`, `window.location.reload` was called once
  4. **Logout clear:** dispatch `new CustomEvent('auth:logout')` via `act(...)` → `activeId` is `null` AND `localStorage.getItem('educandow:activeInstitutionId')` is `null`
- Setup: `beforeEach(() => localStorage.clear())`. Import `getActiveInstitutionId` from store to assert write-through.
- **Dependencies:** T-02 (store fns imported for assertions)

---

### T-07 — Implement active-institution-context.tsx (GREEN for T-06)

- **File (NEW):** `web/src/context/active-institution-context.tsx`
- **Spec:** REQ-01, REQ-02, REQ-04
- **Interface:**
  ```ts
  interface ActiveInstitutionState {
    activeId: string | null;
    setActive: (id: string) => void;
    clear: () => void;
  }
  ```
- **Implementation notes:**
  - `useState(() => getActiveInstitutionId())` — lazy initializer (same pattern as `auth-context.tsx` with `getToken()`)
  - `setActive(id)`: calls `setActiveInstitutionId(id)` → `setState(id)` → `window.location.reload()`
  - `clear()`: calls `clearActiveInstitutionId()` → `setState(null)`
  - `useEffect`: `window.addEventListener('auth:logout', clear)` with cleanup
- **Exports:** `ActiveInstitutionProvider`, `useActiveInstitution`
- **Dependencies:** T-06

---

### T-08 — Mount provider in App.tsx

- **File (MODIFY):** `web/src/App.tsx`
- **Spec:** REQ-01 (global state accessible throughout component tree)
- **Change:**
  - Add import: `import { ActiveInstitutionProvider } from './context/active-institution-context';`
  - Wrap the body of `<InstitutionProvider>` with `<ActiveInstitutionProvider>...</ActiveInstitutionProvider>`
  - Position: directly inside `InstitutionProvider`, outside `ThemeApplier` and siblings (so the provider is always mounted but those siblings can access the context if needed)
- **Dependencies:** T-07

---

### T-09 — Update App.test.tsx for new provider

- **File (MODIFY):** `web/src/__tests__/App.test.tsx`
- **Spec:** REQ-01 (existing routing tests continue to pass)
- **Change:** add mock before the lazy import of `App`:
  ```ts
  vi.mock('../context/active-institution-context', () => ({
    ActiveInstitutionProvider: ({ children }: any) => <>{children}</>,
    useActiveInstitution: () => ({ activeId: null, setActive: vi.fn(), clear: vi.fn() }),
  }));
  ```
- **Verify:** the existing 2 routing test cases (`/profiles`, `/login`) remain green.
- **Note:** The real provider would also pass (it only reads localStorage, no API calls), but the explicit mock keeps the test hermetic and consistent with the InstitutionProvider/AuthProvider pattern already in the file.
- **Dependencies:** T-08

---

### T-10 — Write selector unit tests (RED)

- **File (NEW):** `web/src/components/layout/__tests__/active-institution-selector.test.tsx`
- **Spec:** REQ-02 (ROOT-only, lists institutions), REQ-04 (unselected placeholder), REQ-05 (non-ROOT invisible)
- **Test cases:**
  1. **Non-ROOT → renders null:** mock `useAuth` returning `user: { roles: ['ADMIN'] }` → `container` is empty, nothing in DOM
  2. **ROOT, no active → placeholder shown:** mock `useActiveInstitution` returning `activeId: null`; mock `apiClient.get` returning `[{ id: 'a', name: 'Escuela A' }]` → renders `<select>` with a disabled placeholder option "Seleccioná una institución" and the institution option
  3. **ROOT, fetched list → options rendered:** mock returning 2 institutions → both `<option>` elements present with correct `value` and text
  4. **ROOT selects option → setActive called:** simulate `change` event on `<select>` → `setActive` was called with the selected `id`
- **Mocks needed:** `vi.mock('../../api/client', ...)`, `vi.mock('../../../context/active-institution-context', ...)`, `vi.mock('../../../context/auth-context', ...)`
- **Dependencies:** T-07 (hook must exist for test file to compile cleanly)

---

### T-11 — Implement active-institution-selector.tsx (GREEN for T-10)

- **File (NEW):** `web/src/components/layout/active-institution-selector.tsx`
- **Spec:** REQ-02, REQ-04, REQ-05
- **Implementation notes:**
  - ROOT guard: `const { user } = useAuth(); if (!user?.roles?.includes('ROOT')) return null;`
  - Fetch institutions: `useEffect` calls `apiClient.get('/institutions')` on mount; stores list in local state
  - `<select>` value bound to `activeId`; `onChange` calls `setActive(e.target.value)`
  - First option: `<option value="" disabled>Seleccioná una institución</option>` rendered when `activeId` is null (visual highlight via inline style or CSS class)
  - Institution options: `{ id, name }` from `/institutions` response
- **Dependencies:** T-10

---

### T-12 — Mount selector in DashboardLayout

- **File (MODIFY):** `web/src/components/layout/dashboard-layout.tsx`
- **Spec:** REQ-02 (single selector in app shell, visible only for ROOT)
- **Change:**
  - Add import: `import { ActiveInstitutionSelector } from './active-institution-selector';`
  - Render `<ActiveInstitutionSelector />` adjacent to `<ThemeToggle />` (inside the top-level `<div style={{ display: 'flex' }}>`, before the `<Sidebar>`)
  - No ROOT guard in the layout — the selector is internally ROOT-only and returns null for everyone else
- **Dependencies:** T-11

---

### T-13 — Final verification: test suite + typecheck + coverage

- **Commands:**
  ```
  pnpm --filter web test --coverage
  pnpm --filter web typecheck
  ```
- **Pass criteria:**
  - All tests green (including pre-existing tests for `App`, `institution-context`, `dashboard-layout/sidebar`, etc.)
  - Coverage ≥ 80% for all 3 new files: `active-institution.ts`, `active-institution-context.tsx`, `active-institution-selector.tsx`
  - Zero TypeScript errors
- **Spec:** REQ-01 through REQ-06 (all)
- **Dependencies:** T-01 through T-12

---

## Coverage Map

| Spec Requirement | Tasks |
|---|---|
| REQ-01 (active institution state, localStorage, rehydration) | T-01, T-02, T-06, T-07, T-08 |
| REQ-02 (global ROOT selector in app shell) | T-10, T-11, T-12 |
| REQ-03 (axios interceptor injects institutionId) | T-03, T-04, T-05 |
| REQ-04 (empty state guidance, auto-load on selection) | T-06, T-07, T-10, T-11 |
| REQ-05 (non-ROOT isolation, zero behavioral change) | T-03, T-04, T-10, T-11 |
| REQ-06 (backward compat, call-site institutionId wins) | T-03, T-04 |

---

## Review Workload Forecast

| Category | Estimated lines |
|---|---|
| NEW `api/active-institution.ts` | ~55 |
| MODIFY `api/client.ts` (+import +return) | ~3 |
| NEW `context/active-institution-context.tsx` | ~65 |
| MODIFY `App.tsx` (+import +wrap) | ~4 |
| NEW `components/layout/active-institution-selector.tsx` | ~70 |
| MODIFY `components/layout/dashboard-layout.tsx` | ~5 |
| **Production subtotal** | **~202** |
| NEW `api/__tests__/active-institution.test.ts` | ~90 |
| NEW `context/__tests__/active-institution-context.test.tsx` | ~95 |
| NEW `components/layout/__tests__/active-institution-selector.test.tsx` | ~80 |
| MODIFY `__tests__/App.test.tsx` | ~8 |
| **Test subtotal** | **~273** |
| **TOTAL** | **~475 lines** |

**Chained PRs recommended: Yes**
**400-line budget risk: High** (production-only ~202 lines is well within budget; combined with tests the total ~475 lines exceeds it)
**Decision needed before apply: Yes**

Suggested split if chaining:
- **PR-1** (T-01 → T-05): store + helper + interceptor wire. ~148 lines total. Self-contained: fixes the leak class for every child/hook request the moment a ROOT user has a selection stored. No UI yet.
- **PR-2** (T-06 → T-12 + T-13): context + provider mount + selector + layout. ~327 lines total. Delivers the full UI and wires end-to-end. Depends on PR-1 being merged.

Alternatively: single PR with `size:exception` label (justified because the change is a single atomic feature with no realistic mid-split state that is safe to deploy independently — PR-1 alone adds interceptor behavior without any UI to set the selection, which is only testable but not production-useful on its own).
