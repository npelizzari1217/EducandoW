# Design: Legajos de Alumnos

## Technical Approach

Pure frontend aggregation — no backend changes. The legajo page uses 4 parallel `Promise.all` calls to existing endpoints (`GET /students/:id`, `/enrollments?studentId=`, `/notas?studentId=`, `/attendance?studentId=`). This is the simplest path: zero backend work, zero schema changes, zero migration. Tradeoffs are documented below.

## Architecture Decisions

### Decision 1: Aggregation Strategy

| Option | Tradeoff | Decision |
|--------|----------|----------|
| 4 parallel API calls (current) | Simpler, zero backend work; higher client latency, no pagination | **KEEP** |
| 1 aggregation endpoint `GET /students/:id/legajo` | Better perf, atomic, pagination-ready; requires new use case + controller + joined queries | Defer |

**Rationale**: The 4-call approach is already implemented and working. The aggregation endpoint adds backend complexity (new use case crossing personnel + pedagogy bounded contexts) without a demonstrated need — current data volumes at single-institution deployment don't justify it. Revisit if pagination or performance becomes a requirement.

### Decision 2: Component Structure

**Choice**: Single-page with search → detail flow (already built).  
**Rationale**: Matches existing dashboard patterns (e.g., students page). No route nesting needed. `selectedStudent` state drives conditional rendering — clean and consistent.

### Decision 3: Print Approach

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `@media print` CSS | Simple, no infra; fragile across browsers, no PDF metadata | **KEEP** |
| Server-side PDF generation | Professional output, archival-quality; requires reporting infra, storage | Defer |

**Rationale**: Print CSS works for the immediate need (physical legajo output). Matches proposal scope explicitly excluding PDF generation. Tested on Chrome/Firefox.

### Decision 4: Data Enrichment

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Show raw evaluationId | Simple; not human-readable | **KEEP for now** |
| Fetch evaluations in parallel | Adds 5th API call (`GET /evaluaciones?assignmentId=` per enrollment); no direct `evaluacionId`→assignment mapping in current API | Defer |
| Backend joined endpoint | Requires new aggregation endpoint (Decision 1) | Defer |

**Rationale**: `evaluationId` is functional as identifier — user can cross-reference evaluaciones page. Enrichment requires per-enrollment `GET /subject-assignments?courseSectionId=` → per-assignment `GET /evaluaciones?assignmentId=` chain. This is N+1 territory and belongs in the deferred aggregation endpoint.

### Decision 5: Cache Strategy

**Choice**: No client-side cache. Data reloads on every student selection.  
**Rationale**: Legajo data is read-once (view → print → next). Caching adds complexity (stale data, invalidation) with no benefit for the single-view workflow. Browser HTTP cache covers repeated loads of the same student.

### Decision 6: Error Handling

**Choice**: Partial legajo with per-section fallback. Currently the code does a full error (`Error al cargar el legajo`).  
**Recommendation for apply phase**: Split `Promise.all` into individual `try/catch` per call. If `/enrollments` fails but student + notas + attendance succeed, show the 3 successful sections with an error indicator on Matrículas.

**Rationale**: Partial data is better than zero data. Proposal risk table explicitly lists "per-section error boundaries" as mitigation.

## Data Flow

```
User types query (debounced 300ms)
      │
      ▼
  GET /v1/students/search?q={query}&institutionId={id}
      │
      ▼ (user clicks "Ver legajo")
      │
  Promise.all([
    GET /v1/students/:id           → student detail
    GET /v1/enrollments?studentId= → enrollment history
    GET /v1/notas?studentId=       → grades (evaluationId only)
    GET /v1/attendance?studentId=  → attendance records
  ])
      │
      ▼
  Four Card sections: Datos Personales | Matrículas | Calificaciones | Asistencia
      │
      ▼
  [Print button] → window.print() → @media print CSS
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `web/src/pages/dashboard/legajos.tsx` | Already exists | Legajo page with search + 4-section detail |
| `web/src/App.tsx` | Modified | Route `/legajos` registered (line 42) |
| `web/src/components/layout/sidebar.tsx` | Modified | "Legajos" nav item with `requiresLevel: true` (line 20) |

**No backend files changed**.

## Interfaces / Contracts

All interfaces are local to `legajos.tsx` — no shared types defined. Key types:

```typescript
interface StudentSummary  { id, firstName, lastName, dni, fullName }
interface StudentDetail   { id, firstName, lastName, dni, email?, birthDate?, guardianName?, guardianPhone?, institutionId }
interface Enrollment      { id, studentId, institutionId, level, academicYear, grade?, division?, status, enrolledAt }
interface Nota            { id, evaluationId, numericValue?, qualitativeValue?, gradeCode?, gradeLabel? }
interface AttendanceRecord { id, date, status, statusDescription }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Component | Search debounce, student selection, loading/error states | Vitest + React Testing Library |
| Component | Print CSS applied on window.print() | Visual inspection (hard to automate) |
| Component | Empty states for each section (no enrollments, no grades) | Vitest + mock API responses |
| Integration | 4 parallel API calls resolve correctly | MSW handlers for all endpoints |
| E2E | Full flow: search → select → view sections → print | Cypress or Playwright |

## Migration / Rollout

No migration required. Pure frontend change. Rollback: remove route + nav item + page file. No backend rollback needed.

## Open Questions

- [ ] Should we implement per-section error handling (partial legajo) in apply phase? (Recommend: yes, aligns with proposal risk mitigation)
- [ ] When aggregation endpoint is needed, should it live in `student/` controller or a new `legajo/` bounded context? (Recommend: new controller to avoid bloating `StudentController`)
