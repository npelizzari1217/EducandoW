# Design — Institución Activa Global (ROOT)

> Phase: design (the architectural HOW). Tasks (the step-by-step WHAT-to-do) come next.
> Nivel pedagógico afectado: ALL (cross-cutting, web presentation layer only).
> Backend NestJS unchanged — `tenant.middleware.ts` stays as is.

## 1. Context & Problem Recap

ROOT users carry no tenant in their JWT (`dbName`/`institutionId` null). The backend
`TenantMiddleware` returns **403** on tenant routes unless the request carries
`?institutionId=<id>`. Today the web app solves this AD HOC: ~11 pages each render an
inline `<select>` and manually thread `institutionId` into every call. Children
(`CourseCycleForm.tsx`) and mutation hooks issue their own GET/POST **without**
`institutionId`, which is the leak class that caused the two prod 403 bugs.

Goal: ROOT selects an institution **once**; every outgoing tenant request carries
`institutionId` automatically, with **zero** knowledge required at the page / child /
hook level. Non-ROOT behavior is unchanged.

## 2. Architecture Approach

**Single source of truth + axios request interceptor.** Two collaborating pieces with a
clean separation of concerns, mirroring the existing `token.ts` + interceptor pattern:

1. **Module-level store** (`web/src/api/active-institution.ts`) — the source of truth the
   interceptor reads. Plain functions over `localStorage`, callable from outside React.
2. **React context** (`web/src/context/active-institution-context.tsx`) — a reactive
   mirror of the store for UI consumers (the global selector, an optional badge). It
   writes THROUGH to the module store on every change.

The interceptor (outside React) only ever talks to the module store. The context never
becomes a dependency of `client.ts`. This is the key decoupling: React owns the UI,
`localStorage` owns the hydration-safe truth, and the interceptor reads that truth
synchronously on every request.

```
                 writes through                 reads (sync, no React)
ActiveInstitution ───────────────▶ localStorage ◀──────────────── axios request
   Context (UI)                    (educandow:                     interceptor
      ▲                            activeInstitutionId)                 │
      │ useActiveInstitution()                                          ▼
 Global selector (ROOT only)                              config.params.institutionId
 in DashboardLayout top bar
```

### Why a NEW context instead of extending `institution-context.tsx`

`institution-context.tsx` answers **"what is the current institution's config/branding?"**
— it GETs `/institutions/me` and applies CSS custom properties. That is a *different
question* from **"which institution is ROOT acting as right now?"**. Folding the active
selection into it would:

- couple branding/theme concerns to tenant routing,
- break the `/institutions/me` semantics (ROOT has no "me"),
- bloat a context that already does branding + login/logout listeners.

A dedicated, single-responsibility context keeps both clean and independently testable.
**Decision: new `active-institution-context.tsx`.** (See ADR-1.)

## 3. Components & Data Flow

### 3.1 Module store — `web/src/api/active-institution.ts` (NEW)

Mirrors `token.ts` exactly (namespaced key, synchronous reads):

```ts
const KEY = 'educandow:activeInstitutionId';

export function getActiveInstitutionId(): string | null {
  return localStorage.getItem(KEY);
}
export function setActiveInstitutionId(id: string): void {
  localStorage.setItem(KEY, id);
}
export function clearActiveInstitutionId(): void {
  localStorage.removeItem(KEY);
}
```

Hydration timing is solved for free: `localStorage` is synchronous and survives reloads,
so `getActiveInstitutionId()` returns the persisted value on the very first request after
a page load — before any React effect runs. No race against the first API call.

### 3.2 Param-merge helper — `web/src/api/active-institution.ts` (NEW, same module)

Extracted as a **pure function** so the precedence rule is unit-testable without axios:

```ts
import type { InternalAxiosRequestConfig } from 'axios';

/** Appends the active institutionId to params unless the call site already set one. */
export function applyActiveInstitution(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  const activeId = getActiveInstitutionId();
  if (!activeId) return config;                 // non-ROOT / no selection → no-op
  config.params ??= {};
  // PRECEDENCE: explicit call-site value wins. Only fill when truly absent (null/undefined).
  // An explicit '' (ROOT "Todas") is a deliberate value and is preserved.
  if (config.params.institutionId == null) {
    config.params.institutionId = activeId;
  }
  return config;
}
```

### 3.3 Interceptor wiring — `web/src/api/client.ts` (MODIFIED)

Append one line inside the EXISTING request interceptor (after the auth header):

```ts
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return applyActiveInstitution(config);   // ← added
});
```

No new interceptor, no per-route branching. Master/non-tenant routes ignore an extra
`institutionId` param harmlessly (per proposal), so unconditional append is safe.

### 3.4 React context — `web/src/context/active-institution-context.tsx` (NEW)

```ts
interface ActiveInstitutionState {
  activeId: string | null;
  setActive: (id: string) => void;   // ROOT only; writes through to the module store
  clear: () => void;
}
```

- `useState(() => getActiveInstitutionId())` — lazy initializer from the store (same
  pattern `auth-context.tsx` uses with `getToken()`).
- `setActive(id)` calls `setActiveInstitutionId(id)` THEN updates state, keeping store and
  React in sync. After writing, it triggers a data refresh (see 3.6).
- Listens to the existing `auth:logout` event and calls `clear()` +
  `clearActiveInstitutionId()`. **This is a safety guard**: it prevents a stale ROOT
  selection from leaking into a subsequent non-ROOT login on the same browser.
- Mounted in `App.tsx` directly under `InstitutionProvider`.

### 3.5 Global selector — `web/src/components/layout/active-institution-selector.tsx` (NEW)

- Renders **only for ROOT** (`user?.roles?.includes('ROOT')`); returns `null` otherwise.
- Lists institutions from `GET /institutions` (same call the inline selectors use today),
  fetched once on mount.
- Bound to `useActiveInstitution()`; selecting an option calls `setActive(id)`.
- **Unselected state** (ROOT logged in, nothing chosen yet): the selector shows a
  highlighted placeholder ("Seleccioná una institución"). The empty/guidance state on the
  pages themselves is owned by the spec (requirement #4) — design coordinates with it but
  does not prescribe per-page copy here.
- Mounted in `DashboardLayout` next to `ThemeToggle` (there is no top bar yet; introduce a
  minimal header strip in `main-content`, or place the control beside the existing floating
  `ThemeToggle`). Layout placement is cosmetic and finalized in tasks.

### 3.6 Refresh on change

When ROOT switches institution, in-flight React state keyed on the OLD tenant must
re-fetch. Pages no longer carry `institutionId` in their effect deps once cleaned up, so a
state change alone won't invalidate them.

**MVP decision: `setActive()` performs a full `window.location.reload()` after persisting**
the selection. Rationale: bulletproof, zero per-page coordination, re-hydrates every
context (including branding) consistently with the new tenant, and switching institution is
a rare, deliberate ROOT action where a reload is acceptable UX. (See ADR-3.) A
query-invalidation / event-bus refresh is a documented enhancement, not MVP.

## 4. Non-ROOT Handling

Non-ROOT users **never** write the active institution: only the ROOT-gated selector calls
`setActive`. Therefore `getActiveInstitutionId()` returns `null` for them and
`applyActiveInstitution` is a pure no-op — the request goes out exactly as today, with the
tenant resolved server-side from the JWT/`dbName`. The interceptor itself does **not** read
roles (it is outside React); the role gate lives entirely on the WRITE side (selector) plus
the `auth:logout` clear. This keeps the interceptor dumb and the invariant simple:
*"if a value exists in storage, use it; non-ROOT never puts one there."*

## 5. Migration / Phasing (CRITICAL)

### MVP scope (this change) — files touched

| Action | File |
| --- | --- |
| NEW | `web/src/api/active-institution.ts` (store + `applyActiveInstitution`) |
| MODIFY | `web/src/api/client.ts` (one line in the existing request interceptor) |
| NEW | `web/src/context/active-institution-context.tsx` |
| MODIFY | `web/src/App.tsx` (mount `ActiveInstitutionProvider` under `InstitutionProvider`) |
| NEW | `web/src/components/layout/active-institution-selector.tsx` |
| MODIFY | `web/src/components/layout/dashboard-layout.tsx` (mount the selector) |

That is the entire MVP: **store + interceptor + ONE global selector.**

### Deferred (progressive, NON-BLOCKING follow-up)

Removal of the ~11 inline selectors (`course-cycles.tsx`, `users.tsx`, and the rest) and
of the per-call `institutionId` threading. Done page-by-page, each its own small PR. **Not
part of this change.**

### Coexistence guarantee during the transition

The precedence rule in `applyActiveInstitution` makes the inline selectors and the global
interceptor **safe to run simultaneously**:

- When an inline page passes a concrete `institutionId` (e.g. `course-cycles.tsx`
  `queryParams.institutionId = institutionId`), `config.params.institutionId` is already
  set → the interceptor **skips** it. The inline value wins. No clobber.
- When an inline page passes nothing (ROOT picked "" = "Todas"), `params.institutionId` is
  `undefined` → the interceptor fills it with the global selection.
- A child/hook that issues a bare request (the leak, e.g. `CourseCycleForm.tsx` GETs) now
  silently inherits the global selection — **the bug class is fixed at the source** even
  before the inline selectors are removed.

**Known semantic change to flag (for spec/QA):** for ROOT on a tenant route, the inline
"Todas las instituciones" (empty) option previously produced no `institutionId` → a
guaranteed 403. With the interceptor it now resolves to the active institution and
succeeds. This is strictly better (the "Todas" path was already broken for tenant routes)
but is a behavior change worth a regression note.

## 6. Testability / Clean Separation

- **`active-institution.ts` store**: pure functions over `localStorage` → unit test under
  Vitest + jsdom with a mocked/real `localStorage`. Cases: get returns null when unset; set
  then get; clear removes.
- **`applyActiveInstitution(config)`** (pure, no axios dependency): direct unit tests —
  1. activeId set, no `params.institutionId` → injected;
  2. activeId set, explicit `params.institutionId='inst-X'` → preserved (precedence);
  3. activeId set, explicit `params.institutionId=''` → preserved (deliberate "Todas");
  4. no activeId (non-ROOT) → config returned unchanged, `params` untouched (no-op).
- **Context**: render with Testing Library, assert lazy init from store, `setActive`
  writes through to `localStorage`, and `auth:logout` clears both. Stub
  `window.location.reload` for the refresh assertion.
- **Selector**: renders `null` for non-ROOT; renders options for ROOT.

Strict TDD applies (config `tdd: true`, `pnpm test`, coverage ≥ 80%): the pure store and
helper are written test-first; they are the highest-value, lowest-friction units.

## 7. Architecture Decision Records

### ADR-1 — Dedicated active-institution context vs extending `institution-context.tsx`
**Decision:** new dedicated context.
**Rationale:** different responsibility (acting-as tenant vs branding/config). Avoids
coupling tenant routing to theming and keeps `/institutions/me` semantics intact.
**Rejected:** extending `InstitutionContext` — would overload a branding-focused context and
entangle two lifecycles (login-driven `me` fetch vs ROOT-driven manual selection).

### ADR-2 — Module-level localStorage store as the interceptor's source of truth
**Decision:** interceptor reads a synchronous module getter backed by `localStorage`; the
context mirrors it.
**Rationale:** the interceptor lives outside React and runs before any effect; only a
synchronous, persisted source guarantees the value is present on the first request after
load. Mirrors the proven `token.ts` design.
**Rejected:** (a) a React hook in the interceptor — impossible, it's outside the tree;
(b) an in-memory module variable only — lost on reload, reintroduces the hydration race;
(c) passing `institutionId` from each call site — that is the status quo we are removing.

### ADR-3 — `window.location.reload()` on selection change for MVP
**Decision:** reload after persisting the new selection.
**Rationale:** zero per-page coordination, consistent re-hydration of all contexts, rare
deliberate action. Lets the MVP ship without touching the 11 pages.
**Rejected (deferred):** query-cache invalidation / custom-event bus — cleaner UX but
requires touching data hooks/pages, which is explicitly out of MVP scope.

### ADR-4 — Precedence: explicit call-site value wins; fill only when `== null`
**Decision:** the interceptor injects only when `config.params.institutionId` is
null/undefined.
**Rationale:** guarantees inline selectors and the interceptor coexist without conflict
during the progressive cleanup, and lets a future call site force a specific tenant.
**Rejected:** unconditional overwrite — would clobber inline selectors and make the
migration unsafe.

## 8. Risks / Open Questions

- **Spec dependency:** requirement #4 (selector empty/guidance state and per-page behavior
  when ROOT hasn't selected) must be authored in `spec` before `tasks`. Design defers exact
  UX copy/states to it.
- **"Todas" semantic change** (section 5) — confirm with product that ROOT no longer needs a
  true cross-institution "all" view on tenant routes (it never worked anyway).
- **Reload UX** — acceptable for MVP; revisit if ROOT switches frequently.
- **No top bar today** — `DashboardLayout` has only a floating `ThemeToggle`; selector
  placement is a minor layout addition decided in tasks.
- **Stale selection across role switch** — mitigated by `auth:logout` clear; verify the
  logout event always fires before a new login on shared browsers.
