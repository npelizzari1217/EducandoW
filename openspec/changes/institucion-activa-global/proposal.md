# Proposal: Institución Activa Global (ROOT)

## Intent

**Problem.** In this multitenant NestJS + React app, ROOT users have no tenant in
their JWT (dbName/institutionId null). The backend `TenantMiddleware` returns 403 on
any tenant route unless the request carries `?institutionId=<id>`. The web frontend
solves this AD HOC: ~11 pages each implement an inline institution `<select>` and
manually thread `institutionId` into their API calls. There is no reusable component,
no global state, and no axios interceptor (`web/src/api/client.ts` only adds the auth
header).

**Why now.** The ad-hoc pattern is whack-a-mole and has already caused TWO production
bugs: (1) Carreras de terciario lacked a selector → 403 (fixed inline, PR #31);
(2) Cursos x Ciclo HAS a selector but still 403s because child component
`CourseCycleForm.tsx` issues its own GETs without `institutionId`, and the
create/update/delete hooks are called without it. Even pages WITH a selector leak
through children and hooks. Every new tenant page, child component, or custom hook is
another place to forget the param.

**Success.** A ROOT user selects an institution once; every outgoing tenant request
carries `institutionId` automatically. No page, child component, or hook needs to know
about it. Non-ROOT users see no behavior change.

## Scope

**In scope (web frontend only):**
- New "active institution" global state (React context, persisted in localStorage).
- An axios request interceptor in `web/src/api/client.ts` that appends `institutionId`
  from that state to every outgoing request.
- A single global institution selector in the app layout/top bar.
- Progressive cleanup: redirect/remove the ~11 inline selectors to feed global state.

**Out of scope:**
- Backend changes — `tenant.middleware.ts` is correct and stays as is.
- The unrelated GradingPeriodDate migration.

## Approach & Rationale

Introduce a single source of truth for the ROOT-selected institution plus an
interceptor, instead of patching each call site.

- **Global state (context + localStorage):** ROOT sets it once; survives reloads.
  Non-ROOT users never set it — their tenant comes from the JWT/dbName, so the
  middleware resolves without the param.
- **Axios request interceptor:** appends `institutionId` unconditionally when a ROOT
  selection exists. Master routes ignore the extra param harmlessly, so no per-route
  branching is needed. This fixes the leak class (children, hooks) at the source.
- **One global selector** replaces scattered inline ones, removing the duplication
  that caused the bugs.

## Risks / Open Questions

- Non-ROOT behavior must NOT change; verify the interceptor only acts on ROOT selection.
- Interceptor must not break master/non-tenant routes.
- Initial-load timing of the persisted selection (hydration before first API call).
