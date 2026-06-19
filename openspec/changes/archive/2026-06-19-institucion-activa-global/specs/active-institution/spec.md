---
change: institucion-activa-global
phase: spec
status: draft
date: 2026-06-19
scope: web-only
---

# Spec: Institución Activa Global (ROOT)

## Context

ROOT users have no tenant in their JWT (`dbName: null`, `institutionId: null`). The backend's `TenantMiddleware` returns 403 on any tenant-scoped route unless `?institutionId=<id>` is present. The current frontend solves this ad-hoc on ~11 pages. This change establishes a single, centralized mechanism.

No backend changes are part of this spec.

---

## Definitions

| Term | Meaning |
|---|---|
| **ROOT user** | User whose JWT carries `dbName: null` and `institutionId: null`. |
| **non-ROOT user** | Any user whose JWT carries a non-null `dbName`/`institutionId`. |
| **active institution** | The institution a ROOT user has selected as their working context for the current session. |
| **tenant-scoped page** | Any page that issues API requests requiring a tenant (course cycles, degrees, study plans, etc.). |
| **master route** | Any API route that does not require a tenant (e.g., `GET /institutions`). |
| **explicit institutionId** | An `institutionId` query parameter deliberately set by a call site in its own request config. |

---

## Requirements

### REQ-01 — Active Institution State

1. The application MUST provide a global "active institution" state accessible throughout the entire component tree without prop-drilling.
2. When a ROOT user selects an institution, that selection MUST be persisted in `localStorage` under a stable, documented key.
3. On application startup, the active institution state MUST be rehydrated from `localStorage` synchronously (or before the first authenticated API call is dispatched).
4. The active institution state MUST be `null` for non-ROOT users at all times. Setting it for non-ROOT users is undefined behavior and MUST NOT occur.
5. The state shape MUST expose at minimum `{ id: string; name: string } | null` to consumers.

### REQ-02 — Global Institution Selector

6. A single global institution selector MUST be rendered in the application shell (top bar or navigation layout) and MUST be visible if and only if the current user is ROOT.
7. Non-ROOT users MUST NOT see the global institution selector — it MUST be unconditionally absent from their rendered output.
8. The selector MUST enumerate all institutions available to ROOT (fetched from the master `/institutions` endpoint).
9. Selecting an institution via the selector MUST update the global active institution state and persist it to `localStorage` in the same synchronous operation.
10. After a full page reload, the global selector MUST restore and display the previously selected institution (recovered from `localStorage`).

### REQ-03 — Axios Request Interceptor

11. The axios request interceptor registered in `web/src/api/client.ts` MUST append `institutionId=<activeId>` as a query parameter to every outgoing HTTP request when ALL of the following are true:
    - the current user is ROOT, AND
    - an active institution is currently selected (state is non-null).
12. The interceptor MUST operate at the HTTP transport layer so that no individual page, child component, or custom hook is required to pass `institutionId` explicitly.
13. If a request already carries an `institutionId` query parameter explicitly set by the call site, the interceptor MUST NOT override or duplicate it. Call-site value takes precedence.
14. The interceptor MUST NOT append `institutionId` when the current user is non-ROOT.
15. The interceptor MUST NOT append `institutionId` when the current user is ROOT but the active institution state is `null`.
16. The interceptor reads the active institution state at request time (not at registration time) so it always reflects the currently selected institution.

### REQ-04 — Tenant-Scoped Page Guard (ROOT without selection)

17. When a ROOT user navigates to a tenant-scoped page and no active institution is selected, the page MUST NOT automatically dispatch tenant-scoped API requests (which would result in silent 403s).
18. The page MUST present a clear, actionable prompt guiding the ROOT user to select an institution before any tenant-scoped content is loaded.
19. The prompt MAY be rendered as an inline banner, a blocking empty-state panel, or a redirect to a dedicated institution-picker UI — the exact form is a design-phase decision.
20. Once the ROOT user selects an institution (from the global selector or from within the page prompt), the page content MUST load automatically without requiring a manual reload.

### REQ-05 — Non-ROOT Isolation

21. For non-ROOT users, the active-institution mechanism (context, selector, interceptor injection) MUST be completely transparent: zero visual changes, zero behavioral changes.
22. API requests issued by non-ROOT users MUST NOT gain any `institutionId` query parameter as a result of this change.
23. Non-ROOT users' tenant resolution MUST remain derived exclusively from their JWT (`dbName`), as it was before this change.

### REQ-06 — Backward Compatibility for Inline Call Sites

24. Pages or components that currently pass `institutionId` explicitly in their API calls MUST continue to function correctly after this change is applied.
25. The interceptor MUST apply call-site precedence (REQ-03 item 13) to guarantee compatibility without requiring those call sites to be modified.
26. Progressive cleanup of the ~11 existing inline institution selectors SHOULD happen in a follow-up task. It is NOT a correctness requirement of this change and MUST NOT block delivery.

---

## Acceptance Scenarios

### SC-01 — ROOT selects institution; selection survives reload

```
Given  the user is ROOT
  And  no active institution is stored in localStorage
When   the user opens the global institution selector and selects institution X
Then   the active institution state becomes X
  And  localStorage contains the serialized active institution (id = X.id)
When   the user reloads the page
Then   the active institution state is restored to X before the first API call
  And  the global selector displays X as the current selection
```

### SC-02 — Interceptor injects institutionId for ROOT (child component / custom hook)

```
Given  the user is ROOT
  And  institution X is the active institution
When   CourseCycleForm mounts and fires its own GET requests
  And  those requests do NOT include an explicit institutionId param
Then   every outgoing request carries the query parameter ?institutionId=<X.id>
  And  the backend processes the requests and returns 200 (not 403)
  And  CourseCycleForm did not need to be modified to achieve this
```

### SC-03 — Non-ROOT request is unmodified

```
Given  the user is non-ROOT (JWT contains a valid dbName)
When   the user navigates to the course-cycle list
  And  the page fires API requests
Then   no request carries an injected institutionId query parameter
  And  the tenant is resolved by the backend from the JWT as before
  And  all responses return 200
```

### SC-04 — ROOT with no active institution on a tenant-scoped page

```
Given  the user is ROOT
  And  no active institution is selected (localStorage is empty / null)
When   the user navigates to a tenant-scoped page (e.g., /course-cycles)
Then   no tenant-scoped API request is dispatched automatically
  And  the page displays a clear prompt instructing the user to select an institution
When   the user selects institution Y (from the global selector or the page prompt)
Then   the page issues the API request carrying ?institutionId=<Y.id>
  And  the page content loads without requiring a manual reload
```

### SC-05 — Explicit institutionId at call site takes precedence

```
Given  the user is ROOT
  And  institution X is the active institution
When   a component fires a request with an explicit ?institutionId=<Z.id> in its params
Then   the outgoing HTTP request carries exactly ?institutionId=<Z.id>
  And  the interceptor does not replace, duplicate, or append another institutionId
```

### SC-06 — Master route unaffected when active institution is set

```
Given  the user is ROOT
  And  institution X is the active institution
When   the app calls GET /institutions (a master/non-tenant route)
Then   the request carries ?institutionId=<X.id> (appended by interceptor)
  And  the backend returns 200 (extra param is harmlessly ignored)
  And  the institution list is rendered correctly with no errors
```

---

## Out of Scope

- Backend changes: `TenantMiddleware`, `tenant.middleware.ts`, or any NestJS module.
- Unrelated `GradingPeriodDate` migration.
- Immediate bulk removal of all ~11 existing inline institution selectors (cleanup follow-up).
- Server-side session storage for the active institution.
