# Delta Spec: Legacy Grading Retirement (S1)

> Change: `retiro-evaluaciones-legacy-s1`
> Phase: sdd-spec · Store: hybrid · 2026-06-16
> Slice: S1 of umbrella `retiro-teacher-legacy` (PR B1 — dead surface removal)
> RFC 2119: MUST / MUST NOT / SHOULD / MAY

---

## 1. Scope Declaration

This spec describes the **observable delta** introduced by S1. It states WHAT must be true after the change is applied. It does NOT prescribe HOW (file-level decisions are design-owned).

**Design-owned boundary (explicit):** The precise list of which exports in `evaluation-pages.tsx` are removed versus kept — in particular whether `/periodos` belongs to the legacy or new grading surface — is DESIGN-OWNED. Design MUST read the data source of each page export before deciding. This spec states the principle: **legacy surface gone, new grading surface intact**.

---

## 2. Definitions

| Term | Meaning |
|---|---|
| **Legacy grading surface** | UI routes `/evaluaciones`, `/evaluaciones/notas`, `/notas-trimestrales`, and the admin UI route for `SubjectAssignments`; their page components; and the API endpoints and use-cases that exclusively serve them. |
| **New grading system** | subject-period-grades, subject-final-grades, and competency-valuation subsystems with their own pages, routes, and API endpoints. |
| **Boletin** | PDF generation via `generate-boletin.use-case.ts`, which reads `SubjectAssignment` records to display teacher names. |
| **Data layer** | Prisma schema models `SubjectAssignment`, `Evaluacion`, `NotaTrimestral` and all rows in those tables. |

---

## 3. Delta Requirements

### 3.1 Frontend — Legacy Routes Unreachable

**REQ-F1** — The application MUST NOT register any client-side route that renders a legacy grading page. Specifically:

- `/evaluaciones` MUST NOT render `EvaluacionesPage` or any descendant legacy component after this change.
- `/evaluaciones/notas` (or equivalent nested path) MUST NOT render the legacy notas page.
- `/notas-trimestrales` MUST NOT render `NotasTrimestralesPage`.
- The admin route that rendered `SubjectAssignmentsPage` MUST NOT be registered.

**REQ-F2** — Navigation entries (sidebar links, menu items) that pointed exclusively to the legacy grading routes MUST be removed. No dead navigation links to legacy pages MUST remain.

**REQ-F3** — Page component files (or the specific exports within them) that exclusively serve the legacy grading surface MUST be deleted. Shared files that also contain exports used by the new grading system MUST NOT be deleted wholesale; only the legacy exports MUST be removed.

### 3.2 Backend — Legacy API Endpoints Removed

**REQ-B1** — The following HTTP routes MUST NOT be registered in the NestJS application after this change:

- `POST /subject-assignments`
- `GET /subject-assignments`
- `DELETE /subject-assignments/:id` (and any parameterized variant)
- `GET /evaluaciones` and any sub-paths that exclusively served the legacy evaluation listing/CRUD.
- `POST /evaluaciones`, `PATCH /evaluaciones/:id`, `DELETE /evaluaciones/:id` (legacy evaluation CRUD).
- `GET /notas-trimestrales` and any sub-paths that exclusively served the legacy trimestral-notes listing/CRUD.
- `POST /notas-trimestrales`, `PATCH /notas-trimestrales/:id`, `DELETE /notas-trimestrales/:id`.

**REQ-B2** — The use-cases `CreateSubjectAssignmentUC`, `ListSubjectAssignmentsUC`, and `DeleteSubjectAssignmentUC` MUST be deleted, along with their DTOs and unit tests.

**REQ-B3** — The legacy CRUD use-cases for `Evaluacion` and `NotaTrimestral` MUST be deleted, along with their DTOs and unit tests.

**REQ-B4** — `pedagogy.module.ts` MUST NOT declare deleted use-cases as providers. The DI container MUST compile without errors related to missing providers.

### 3.3 New Grading System — Unaffected

**REQ-N1** — All client-side routes belonging to the new grading system (subject-period-grades, subject-final-grades, competency valuations) MUST remain registered and MUST render their pages correctly.

**REQ-N2** — All API endpoints belonging to the new grading system MUST remain registered and MUST return correct responses.

**REQ-N3** — Use-cases for competency valuations (`competency.use-cases.ts` and peers) MUST NOT be deleted or modified by this change.

### 3.4 Data Preservation — Hard Requirement

**REQ-D1** — `schema.prisma` (both master and tenant schemas) MUST NOT be modified by this change. No model, field, relation, or index is added, removed, or renamed.

**REQ-D2** — No Prisma migration MUST be created or applied as part of this change.

**REQ-D3** — All rows in tables `SubjectAssignment`, `Evaluacion`, and `NotaTrimestral` MUST be intact and queryable after this change is deployed.

### 3.5 Boletin — No Regression

**REQ-BL1** — `generate-boletin.use-case.ts` (and all boletin generation paths: Primario, Secundario, legacy Inicial/Terciario) MUST continue to read `subjectAssignment.findMany({ include: { teacher } })` without error.

**REQ-BL2** — The domain entity, repository interface, and infrastructure implementation that `generate-boletin` depends on for `SubjectAssignment` access MUST be preserved (removal is S2).

**REQ-BL3** — PDF boletin generation MUST produce correct output for all levels after this change. No boletin regression is acceptable.

### 3.6 Build and Type Correctness

**REQ-TC1** — `pnpm --filter api typecheck` (`tsc --noEmit`) MUST pass with zero errors after the change.

**REQ-TC2** — `vite build` (web) MUST complete successfully with zero errors.

**REQ-TC3** — `pnpm build` (monorepo root via Turbo) MUST pass for all workspaces.

**REQ-TC4** — No dead imports or unresolved references to deleted modules MUST remain in any file after the change.

### 3.7 Test Suite

**REQ-T1** — Tests that exclusively cover deleted code (subject-assignment CRUD use-cases, legacy evaluacion/nota-trimestral CRUD use-cases) MUST be deleted alongside the code they test.

**REQ-T2** — All remaining tests MUST pass: `pnpm --filter api test` (Vitest) returns zero failures.

**REQ-T3** — Test coverage for surviving code MUST NOT regress below the project baseline (80 %).

---

## 4. Acceptance Scenarios

### Scenario 1 — Legacy UI route is unreachable

```
Given  a browser session with an authenticated user
When   the user navigates to /evaluaciones
Then   the app does NOT render the EvaluacionesPage component
And    the app SHOULD render a 404 page or redirect to a valid route
And    no console error about a missing lazy-loaded chunk occurs
```

### Scenario 2 — Legacy API endpoint returns 404

```
Given  the NestJS application is running after S1 is deployed
When   a client sends POST /subject-assignments with a valid body
Then   the server responds with HTTP 404
And    the route is not listed in any Swagger/OpenAPI spec if one exists

When   a client sends GET /subject-assignments
Then   the server responds with HTTP 404

When   a client sends DELETE /subject-assignments/123
Then   the server responds with HTTP 404
```

### Scenario 3 — Legacy evaluaciones/notas-trimestrales API returns 404

```
Given  the NestJS application is running after S1 is deployed
When   a client sends GET /evaluaciones
Then   the server responds with HTTP 404

When   a client sends GET /notas-trimestrales
Then   the server responds with HTTP 404
```

### Scenario 4 — New grading endpoints are unaffected

```
Given  the NestJS application is running after S1 is deployed
When   a client sends a valid request to any subject-period-grades endpoint
Then   the server responds with the same HTTP status and body as before this change

When   a client sends a valid request to any subject-final-grades endpoint
Then   the server responds with the same HTTP status and body as before this change

When   a client sends a valid request to any competency-valuation endpoint
Then   the server responds with the same HTTP status and body as before this change
```

### Scenario 5 — Data rows survive the change

```
Given  SubjectAssignment, Evaluacion, and NotaTrimestral tables have existing rows
When   S1 is deployed (no migration is run)
Then   SELECT COUNT(*) on each table returns the same count as before deployment
And    the Prisma schema diff reports zero changes
```

### Scenario 6 — Boletin generation does not regress

```
Given  a tenant with at least one SubjectAssignment row linked to a Teacher
When   generate-boletin.use-case.ts is invoked for that tenant
Then   it completes without error
And    the resulting PDF includes the teacher name derived from SubjectAssignment
```

### Scenario 7 — Build and typecheck are clean

```
Given  the codebase after all deletions in S1 are applied
When   pnpm --filter api typecheck is run
Then   it exits with code 0 and zero TypeScript errors

When   vite build is run for the web workspace
Then   it exits with code 0

When   pnpm build is run at the monorepo root
Then   it exits with code 0 for all workspaces
```

### Scenario 8 — No dead navigation links

```
Given  the web app is rendered after S1 is deployed
When   the sidebar / nav is inspected
Then   no link points to /evaluaciones, /notas-trimestrales, or the SubjectAssignments admin route
```

---

## 5. Out-of-Scope (Explicit Non-Requirements for S1)

- Migrating the boletin lookup from `SubjectAssignment` to `DocenteXCiclo` → User (S2).
- Removing the domain entity, repository, or infrastructure for `SubjectAssignment` (S2).
- Dropping or archiving `Evaluacion` / `NotaTrimestral` data (S3).
- Removing `Teacher`, `/teachers` page, `MesaExamen`, or `ActaExamen` (Teacher track, decisions open).
- Any Prisma migration or data transformation.

---

## 6. Design Delegation Note

Design MUST resolve:

1. Which exports in `evaluation-pages.tsx` are kept vs removed (especially `PeriodosPage` — verify its data source before deleting).
2. Whether any endpoint path under `/evaluaciones/*` is shared with the new grading system.
3. That `pedagogy.module.ts` provider list is correct after removal — no DI orphan errors.
