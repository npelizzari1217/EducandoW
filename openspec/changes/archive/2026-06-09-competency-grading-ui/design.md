# Design — competency-grading-ui (Fase 3b)

Architecture for making Fase-3 competency grading usable end-to-end: 3 backend read
endpoints + a CourseCycle-first grading UI, following the project's
domain → application → infrastructure / presentation clean-arch layering.

---

## Resolved Decisions (spec-flagged)

### D1 — `studyPlanSubjectId` type: **UUID String** (not int)

`StudyPlanSubject.id` is `String @id @default(uuid())` (schema.prisma:599). Every related
key is a UUID string: `SubjectCompetency.studyPlanSubjectId`, `CompetencyValuation.{studentId,
competencyId}`, `CompetencyValuation.courseCycleId` (FK → `CourseCycle.uuid`, also String),
`CompetencyPeriodValuation.periodItemId`, `gradeScaleValueId`. The spec example
`studyPlanSubjectId=10` is illustrative only — **the real param is a uuid string**.

Consequences:
- New bulk-read query param `studyPlanSubjectId` is treated as an opaque string (no `parseInt`).
- The existing `GET /competency-valuations` already takes `studyPlanSubjectId` as a raw string
  (`listCompetencies`/`listValuations` pass it straight to the repo). We stay consistent.
- The UI `CourseCycleSubjectSelector` already emits `studyPlanSubjectId` as the
  `StudyPlanSubject.id` string (see `PlanCourseSubjectSelector`, where `subject.id` IS the
  studyPlanSubjectId). No numeric coercion anywhere.

### D2 — `internalStatus` badge colors: **reuse `grading-scales.tsx` color map verbatim**

From `grading-scales.tsx:668-672` (the canonical map — do NOT invent tokens):

```ts
const colorMap: Record<string, string> = {
  APROBADO:    'var(--color-success)',
  NO_APROBADO: 'var(--color-danger)',
  EN_PROCESO:  'var(--color-warning, #f59e0b)',
  LIBRE:       'var(--color-text-muted)',
};
// null internalStatus → no badge
```

The grid extracts this into a shared `internalStatusColor(status)` helper (co-located with the
grid or a tiny `grading-status.ts`) so both pages reference one source. Labels reuse
`INTERNAL_STATUS_LABELS` (same file, lines 47-52).

### D3 — "Guardar todo" concurrency: **bounded parallel via `Promise.allSettled` (cap ≈ 5)**

`TenantContext` is resolved **per HTTP request** (AsyncLocalStorage; each PATCH is an
independent request with its own tenant client — confirmed in
`PrismaCompetencyValuationRepo.client` / `AutoCreate.client`). Therefore parallel PATCHes are
**safe**: there is no shared mutable server-side context across requests.

- Fully **sequential** is correct but slow: a class of 30 students × 8 competencies = 240
  potential dirty cells → 240 serial round-trips.
- **Unbounded parallel** risks a DB-connection / pool spike (each PATCH also triggers a boletín
  invalidation write).
- **Bounded parallel (≈5 in-flight)** with `Promise.allSettled` is the recommendation: fast,
  load-friendly, and `allSettled` yields per-cell success/failure granularity that maps directly
  to scenarios CGG-6 (per-cell error) and CGG-7 (clear dirty only on success). Failed cells stay
  dirty with an error indicator; the user can re-run "Guardar todo" to retry only those.

---

## Backend Design (PR slice 1 — must land before UI)

### Read 1 — Bulk valuations (`GET /v1/competency-valuations?courseCycleId=&studyPlanSubjectId=`)

- **Port** (`packages/domain/.../competency-valuation-repository.ts`): add
  `findByCourseCycleAndStudyPlanSubject(courseCycleId, studyPlanSubjectId): Promise<CompetencyValuationWithPeriods[]>`
  where the returned shape carries each parent plus its `periodValuations[]`. Define a read
  model type `CompetencyValuationWithPeriods` (parent fields + children array) — this is a
  read projection, not the write entity, so it lives beside the port as a query result type.
- **Infra** (`PrismaCompetencyValuationRepo`): resolve `competencyId in (SubjectCompetency where
  studyPlanSubjectId)`, then `competencyValuation.findMany({ where: { courseCycleId,
  competencyId: { in }, deletedAt: null }, include: { periodValuations: true } })`. Map to the
  read model; a parent with zero children → `periodValuations: []` (Prisma include yields `[]`,
  satisfying BVR-5).
- **UC** `ListBulkCompetencyValuationsUC.execute({ courseCycleId, studyPlanSubjectId })` →
  returns the read models. No 404 path — empty is `{ data: [] }` (BVR-4).
- **Controller** (`PedagogyController.listValuations`, already owns `/competency-valuations`):
  branch on presence of `courseCycleId`. If `courseCycleId` present → require BOTH params
  (`studyPlanSubjectId` too) else **400**; call the new UC; map to the bulk response shape
  (`valuationId`, `studentId`, `competencyId`, `periodValuations[...]`). Legacy `studentId`
  branch retained for backward-compat. Thin controller; **400** for missing params (project
  override).

### Read 2 — Students by cycle (`GET /v1/course-cycles/:uuid/students`)

Shared-logic decision (avoid duplicating `findEnrolledStudentIds`): **NOT** a method on
`CourseCycleRepository` consumed by `AutoCreate` — that would reintroduce the circular DI that
`AutoCreate` deliberately avoids (PedagogyModule ⟷ CourseCycleModule; `AutoCreate` uses
`TenantContext.getClient()` directly for exactly this reason). Instead:

- **Extract a single infra query helper** `findEnrolledStudentsByCourseCycle(client, courseCycleUuid)`
  in `infrastructure/persistence/prisma/queries/enrolled-students.query.ts`. It encapsulates the
  one true join: `courseCycle → courseSection (level/grade/division/academicYear) → enrollment
  (status=ACTIVE, deletedAt=null) → student`. Returns `{ studentId, firstName, lastName }[]`
  (Student has `firstName`/`lastName`, schema.prisma:16-17).
- **`AutoCreateCompetencyValuationsUC`**: replace its private `findEnrolledStudentIds` +
  inline enrollment query with a call to the helper (`.map(s => s.studentId)`). Removes the
  duplication; keeps `TenantContext` access; no new DI, no cycle.
- **New `ListStudentsByCourseCycleUC`** (course-cycle app layer): inject
  `PrismaCourseCycleRepository`; add a thin repo method `findEnrolledStudents(uuid)` that calls
  the helper. UC first checks the cycle exists (`findByUuid`) → **404** (SBC-2) if not; else
  returns the list (empty `[]` is 200, SBC-3).
- **Controller**: `GET ':uuid/students'` on `CourseCycleController`.

### Read 3 — modality in `GET /v1/course-cycles/:uuid`

The `CourseCycle` entity has no `modality`; it is derived via `StudyPlan.modality`
(`findGradingContextByUuid` already returns `{ level, modality }`). **`GetCourseCycleUseCase`**
additionally calls `repo.findGradingContextByUuid(uuid)` and returns
`{ cycle, modality }`; the controller's `toResponse` adds `modality`. All existing fields
unchanged (CCM-1). Low risk.

### Module wiring

- `pedagogy.module.ts`: provide `ListBulkCompetencyValuationsUC` (inject competency-valuation
  repo) and inject it into `PedagogyController`.
- `course-cycle.module.ts`: provide `ListStudentsByCourseCycleUC` (inject
  `PrismaCourseCycleRepository`); `GetCourseCycleUseCase` factory unchanged in signature (repo
  already injected). Both follow the existing `useFactory` + Symbol-token convention.

---

## Frontend Design (slice 2 — chained, see manifest)

### Data flow / fetch order (on full selection from the selector)

1. `GET /course-cycles/:uuid/students` → rows
2. `GET /subject-competencies?studyPlanSubjectId=` → columns
3. `GET /grading/period-templates?level=&modality=` → period tabs (`items[]`)
4. `GET /grading/scales?level=&modality=` → dropdown options (sorted by `sortOrder`)
5. `GET /competency-valuations?courseCycleId=&studyPlanSubjectId=` → cell values

1–5 fire in parallel on mount/input-change; a single loading gate (CGG-12) blocks interaction
until all resolve. Each `useApiList`/`apiClient.get` follows the existing client/hooks layer
(no scattered fetches — ui-patterns rule).

### `CompetencyGradingGrid` state model

```
activePeriodItemId: string                       // selected period tab
cells: Map<cellKey, CellState>                   // cellKey = `${valuationId}:${periodItemId}`
CellState = {
  valuationId, studentId, competencyId, periodItemId,
  gradeScaleValueId: string | null,
  gradeCode: string | null,
  internalStatus: Status | null,
  modificable: boolean,                          // false → disabled + lock icon (CGG-3)
  saveState: 'idle' | 'dirty' | 'saving' | 'error',
}
```

- Cells indexed by `(student × competency)` for the **active period** only (fixed-period view).
- A cell with no child valuation for the active period → empty/placeholder dropdown, `idle`.
- **Dirty tracking**: dropdown change → set `gradeScaleValueId`, mark `dirty`, fire per-cell
  PATCH (optimistic) → `saving` → on 200 update `gradeCode`/`internalStatus`, clear to `idle`
  (CGG-5); on non-2xx → `error`, keep dirty value for retry (CGG-6).
- **"Guardar todo"**: collect all `dirty`/`error` cells, run bounded-parallel `allSettled`
  (D3); per-result update each cell (CGG-7).
- Period nav: switching `activePeriodItemId` re-derives visible cells from the loaded valuation
  data (no refetch) — the same (student,competency) shows that period's child (CGG-2).
- Empty/edge states: no students (CGG-8), no competencies (CGG-9), no template (CGG-10), no
  scale (CGG-11) each render their own message; the grid handles loading/empty/error per
  ui-patterns.

### `CourseCycleSubjectSelector` (controlled, 3-level cascade)

AcademicCycle → CourseCycle → Subject. Per-dropdown loading/empty/error + retry (CCSS-4/5/6),
resets cascade downward (CCSS-2/3), emits the full
`{ courseCycleId, studyPlanId, studyPlanSubjectId, level, modality }` only when complete
(CCSS-1/7). `level`/`modality` come from `GET /course-cycles/:uuid` (now includes modality via
Read 3); `studyPlanId` + subjects come from `GET /study-plans/:studyPlanId`. Cannot reuse
`PlanCourseSubjectSelector` (it has no `courseCycleId`). Follows that component's style/markup
conventions and the ROOT institution-selector pattern from `grading-scales.tsx` where relevant.

### Page + wiring + cleanup

- `competency-grading.tsx` page: renders selector + grid; ROOT institution guard if needed.
- `App.tsx`: add `/competency-grading` route. `sidebar.tsx`: "Calificación de Competencias"
  under Académico.
- `competencies.tsx`: remove `ValuationsTab` import/render and all legacy `valoracion1..4` /
  `modificable1..4` / `imprimible1..4` payload code (VTC-1/2); leave other tabs intact (VTC-3).

---

## File Manifest — PR slices with line estimates

**Chaining required: YES** (frontend exceeds the 400-line review budget; backend is borderline).

### PR Slice 1 — Backend reads (BLOCKS UI, lands first)
| File | Change | ~Lines |
|---|---|---|
| `packages/domain/.../competency-valuation-repository.ts` | + port method + read-model type | 10 |
| `packages/domain/.../course-cycle-repository.ts` | + `findEnrolledStudents` + `EnrolledStudent` type | 8 |
| `infra/.../prisma/queries/enrolled-students.query.ts` | NEW shared join helper | 35 |
| `infra/.../prisma-competency-valuation.repository.ts` | + bulk read w/ include + map | 45 |
| `infra/.../prisma-course-cycle.repository.ts` | + `findEnrolledStudents` (uses helper) | 18 |
| `application/pedagogy/.../competency.use-cases.ts` | + `ListBulkCompetencyValuationsUC`; refactor `AutoCreate` to helper | 35 |
| `application/course-cycle/.../course-cycle.use-cases.ts` | + `ListStudentsByCourseCycleUC`; `GetCourseCycleUseCase` returns modality | 40 |
| `presentation/pedagogy/pedagogy.controller.ts` (+ dto) | branch bulk read + 400 guards + map | 45 |
| `presentation/course-cycle/course-cycle.controller.ts` | + `GET :uuid/students`; modality in `toResponse` | 30 |
| `presentation/{pedagogy,course-cycle}/*.module.ts` | wire new UCs | 30 |
| **Tests** (TDD, mandatory): UC + repo + controller specs | NEW/extend | ~190 |

Slice 1 ≈ **300 prod + ~190 test ≈ 490 lines** → **400-budget risk: High.** If the reviewer
budget is strict, split into two stacked work-unit PRs:
- **1a** bulk-valuations-read (port + repo + UC + controller + tests)
- **1b** students-by-cycle + modality (helper + AutoCreate refactor + UC + controller + tests)

### PR Slice 2a — Selector + page shell + wiring + cleanup
| File | Change | ~Lines |
|---|---|---|
| `web/.../components/CourseCycleSubjectSelector.tsx` | NEW | 190 |
| `web/.../competency-grading.tsx` | NEW page shell (selector + slot) | 70 |
| `web/src/App.tsx` | + route | 5 |
| `web/.../layout/sidebar.tsx` | + entry | 6 |
| `web/.../competencies.tsx` | remove ValuationsTab + legacy payload | −150/+0 |
≈ **270 net new** (cleanup is deletion).

### PR Slice 2b — Grid + save logic
| File | Change | ~Lines |
|---|---|---|
| `web/.../components/CompetencyGradingGrid.tsx` | NEW (matrix, period nav, badges, locks) | 300 |
| `web/.../grading-status.ts` (or inline helper) | shared status color/label map | 20 |
| grid data hook (optional `use-grading-grid.ts`) | parallel fetch + bounded-save | 70 |
| `web/.../competency-grading.tsx` | wire grid into page | +20 |
≈ **390** → at budget; keep grid isolated in its own PR.

---

## Risks / assumptions

- **Sequencing risk**: Slice 1 (2 CRITICAL reads) MUST merge before any UI slice or the grid
  has no data — enforced by stacking.
- **Backend budget**: Slice 1 ≈490 lines incl. tests → chain into 1a/1b if reviewer enforces
  400 hard.
- **Frontend budget**: total UI ≈660 lines → must chain (2a → 2b).
- **Derived student list** (no Enrollment→CourseCycle FK) is intentional Fase-4 debt; the
  helper centralizes it so the FK swap later touches one file.
- **Assumption**: grade-scale `values[]` and `internalStatus` enum values match the four known
  statuses; any new status falls through to no-color/no-badge (verify during apply).
- **OUT OF SCOPE (Fase 4)**: Enrollment→CourseCycle FK, libreta/boletín, report cards.
