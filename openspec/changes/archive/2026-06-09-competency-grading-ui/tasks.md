# Tasks — competency-grading-ui (Fase 3b)

Chained delivery: **4 PRs** — 1a → 1b → 2a → 2b.  
Strict TDD Mode active: RED (failing test) → GREEN before commit.  
Runners: `pnpm --filter domain test`, `pnpm --filter api test`, `pnpm --filter web test`, `pnpm --filter web lint`.

---

## PR 1a — Backend: Bulk Valuations Read (~280 lines)

**Satisfies**: BVR-1, BVR-2, BVR-3, BVR-4, BVR-5, BVR-6  
**Dependencies**: none (first in chain)  
**Parallelism**: tasks 1a-T1 and 1a-T2 can proceed in parallel after design review; 1a-T3 requires both; 1a-T4 requires 1a-T3; 1a-T5 requires 1a-T4.

### 1a-T1 — Domain port: add read-model type + port method [x]
- **RED**: write test in `packages/domain/src/pedagogy/__tests__/competency-valuation-repository.test.ts` (or equivalent) asserting the port exposes `findByCourseCycleAndStudyPlanSubject`
- **File**: `packages/domain/src/pedagogy/repositories/competency-valuation-repository.ts`
- Add `CompetencyValuationWithPeriods` read-model type (parent fields + `periodValuations: CompetencyPeriodValuationData[]`)
- Add method signature `findByCourseCycleAndStudyPlanSubject(courseCycleId: string, studyPlanSubjectId: string): Promise<CompetencyValuationWithPeriods[]>`
- Run `pnpm --filter domain test` → GREEN; then `pnpm --filter domain build`

### 1a-T2 — Application UC: ListBulkCompetencyValuationsUC [x]
- **RED**: write failing test in `api/src/application/pedagogy/__tests__/competency.use-cases.test.ts` for `ListBulkCompetencyValuationsUC.execute({ courseCycleId, studyPlanSubjectId })` with mock repo
- **File**: `api/src/application/pedagogy/use-cases/competency.use-cases.ts`
- Implement `ListBulkCompetencyValuationsUC` as `@Injectable()` use case; single `execute()` method delegating to `findByCourseCycleAndStudyPlanSubject`; returns read-model list (no 404 path — empty list is 200)
- Run `pnpm --filter api test` → GREEN

### 1a-T3 — Infrastructure: bulk read implementation in PrismaCompetencyValuationRepo [x]
- **RED**: write failing integration/unit test in `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-competency-valuation.repository.test.ts` asserting the new method resolves `competencyId in SubjectCompetency(studyPlanSubjectId)` then includes `periodValuations`
- **File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-competency-valuation.repository.ts`
- Implement `findByCourseCycleAndStudyPlanSubject`: query `subjectCompetency.findMany({ where: { studyPlanSubjectId } })` → extract `competencyId[]`, then `competencyValuation.findMany({ where: { courseCycleId, competencyId: { in }, deletedAt: null }, include: { periodValuations: true } })`; map to `CompetencyValuationWithPeriods`; parent with 0 children → `periodValuations: []` (BVR-5)
- Run `pnpm --filter api test` → GREEN

### 1a-T4 — Presentation: DTO + controller branch in PedagogyController.listValuations [x]
- **RED**: write failing tests in `api/src/presentation/pedagogy/__tests__/competency.controller.spec.ts` for:
  - BVR-2: GET with only `studyPlanSubjectId` → 400
  - BVR-3: GET with only `courseCycleId` → 400
  - BVR-1/4: GET with both params → 200 + `{ data: [...] }` shape
- **Files**: `api/src/presentation/pedagogy/dto/competency.dto.ts`, `api/src/presentation/pedagogy/pedagogy.controller.ts`
- Add `BulkValuationResponseDto` (valuationId, studentId, competencyId, `periodValuations[]`) and `BulkValuationQueryDto` (both params required with `@IsNotEmpty()`)
- In `PedagogyController.listValuations`: branch on `courseCycleId` presence; if present require both params (throw `BadRequestException` if either missing) → call `ListBulkCompetencyValuationsUC`; keep legacy `studentId` branch unchanged; map to bulk response shape
- Run `pnpm --filter api test` → GREEN

### 1a-T5 — Module wiring: pedagogy.module.ts [x]
- **File**: `api/src/presentation/pedagogy/pedagogy.module.ts`
- Provide `ListBulkCompetencyValuationsUC` using Symbol token and `useFactory`; inject `CompetencyValuationRepository` token; add to `PedagogyController` constructor injection
- Run `pnpm --filter api test` → GREEN (smoke: module builds without DI error)

---

## PR 1b — Backend: Students by Cycle + Course-Cycle Modality (~200 lines)

**Satisfies**: SBC-1, SBC-2, SBC-3, CCM-1, CCM-2  
**Dependencies**: PR 1a merged  
**Parallelism**: 1b-T1 and 1b-T2 in parallel; 1b-T3 requires 1b-T1; 1b-T4 requires 1b-T3; 1b-T5 requires domain port from 1b-T2; 1b-T6 requires 1b-T4 + 1b-T5; 1b-T7 requires 1b-T6.

### 1b-T1 — Infrastructure helper: findEnrolledStudentsByCourseCycle [x]
- **RED**: write unit test asserting the helper returns `{ studentId, firstName, lastName }[]` given a mocked Prisma client; verifies `ACTIVE` enrollment filter and `deletedAt: null`
- **File**: `api/src/infrastructure/persistence/prisma/queries/enrolled-students.query.ts` (NEW)
- Extract `findEnrolledStudentsByCourseCycle(client: PrismaClient, courseCycleUuid: string): Promise<EnrolledStudentRow[]>`; encapsulates join: `courseCycle → courseSection → enrollment(status=ACTIVE, deletedAt:null) → student(firstName, lastName)`; returns `{ studentId, firstName, lastName }[]`
- Run `pnpm --filter api test` → GREEN

### 1b-T2 — Domain port: add findEnrolledStudents + EnrolledStudent type to CourseCycleRepository [x]
- **File**: `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts`
- Add `EnrolledStudent` type `{ studentId: string; firstName: string; lastName: string }`
- Add port method `findEnrolledStudents(uuid: string): Promise<EnrolledStudent[]>`
- Run `pnpm --filter domain build`

### 1b-T3 — Infrastructure: implement findEnrolledStudents in PrismaCourseCycleRepository [x]
- **RED**: write failing test in `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-course-cycle.repository.test.ts` for `findEnrolledStudents` calling the shared query helper
- **File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-course-cycle.repository.ts`
- Implement `findEnrolledStudents(uuid)` delegating to `findEnrolledStudentsByCourseCycle(this.client, uuid)`
- Run `pnpm --filter api test` → GREEN

### 1b-T4 — Refactor: AutoCreateCompetencyValuationsUC uses shared helper [x]
- **RED**: write/update test in `api/src/application/pedagogy/__tests__/competency.use-cases.test.ts` asserting `AutoCreateCompetencyValuationsUC` still produces the same `studentId[]` list after the refactor (regression guard)
- **File**: `api/src/application/pedagogy/use-cases/competency.use-cases.ts`
- Replace `AutoCreate`'s private `findEnrolledStudentIds` + inline enrollment query with a call to `findEnrolledStudentsByCourseCycle(this.tenantContext.getClient(), courseCycleUuid).then(s => s.map(s => s.studentId))`; no new DI, no circular dependency
- Run `pnpm --filter api test` → GREEN

### 1b-T5 — Application UC: ListStudentsByCourseCycleUC [x]
- **RED**: write failing tests in `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts`:
  - SBC-2: cycle not found → throws NotFoundException (404)
  - SBC-3: cycle with no students → returns `[]`
  - SBC-1: cycle with students → returns `[{ studentId, firstName, lastName }]`
- **File**: `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts`
- Implement `ListStudentsByCourseCycleUC.execute(uuid)`: call `repo.findByUuid(uuid)` → throw `NotFoundException` if null; call `repo.findEnrolledStudents(uuid)` → return list
- Run `pnpm --filter api test` → GREEN

### 1b-T6 — Application + Presentation: modality in GetCourseCycleUseCase + controller [x]
- **RED**: write/update tests in `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts` for `GetCourseCycleUseCase` returning `{ cycle, modality }`; and in `api/src/presentation/course-cycle/__tests__/course-cycle.dto.test.ts` for response including `modality`
- **Files**: `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts`, `api/src/presentation/course-cycle/dto/course-cycle.dto.ts`, `api/src/presentation/course-cycle/course-cycle.controller.ts`
- `GetCourseCycleUseCase.execute(uuid)`: additionally call `repo.findGradingContextByUuid(uuid)` → return `{ cycle, modality: context.modality }`
- `toResponse` in DTO/controller: add `modality` field; all prior fields unchanged (CCM-1)
- Run `pnpm --filter api test` → GREEN

### 1b-T7 — Presentation + module wiring: GET :uuid/students route + module [x]
- **RED**: write failing test in `api/src/presentation/course-cycle/__tests__/course-cycle.dto.test.ts` (or dedicated controller test) for `GET /v1/course-cycles/:uuid/students` returning 200+list and 404 for unknown uuid
- **Files**: `api/src/presentation/course-cycle/course-cycle.controller.ts`, `api/src/presentation/course-cycle/course-cycle.module.ts`
- Add `@Get(':uuid/students')` handler in `CourseCycleController`; delegates to `ListStudentsByCourseCycleUC`; maps to `[{ studentId, firstName, lastName }]` response
- Provide `ListStudentsByCourseCycleUC` in `course-cycle.module.ts` with Symbol token + `useFactory`
- Run `pnpm --filter api test` → GREEN

---

## PR 2a — Frontend: Selector + Page Shell + Cleanup (~270 net lines)

**Satisfies**: CCSS-1–7, VTC-1–3; adds route/sidebar entry (CGG page shell)  
**Dependencies**: PR 1a AND PR 1b merged (selector needs modality from GET /course-cycles/:uuid/students)  
**Parallelism**: 2a-T1 (cleanup, pure deletion) can be done independently; 2a-T2 and 2a-T3 sequential; 2a-T4 requires 2a-T3; 2a-T5 requires 2a-T3 and 2a-T4.

### 2a-T1 — Cleanup: remove ValuationsTab from competencies.tsx [x]
- **RED**: write/update failing test in `web/src/pages/dashboard/__tests__/competency-ui.test.tsx` asserting `ValuationsTab` is NOT rendered and `valoracion1..4` fields are NOT referenced
- **File**: `web/src/pages/dashboard/competencies.tsx`
- Remove `ValuationsTab` import and render call (VTC-1); remove all references to `valoracion1`, `valoracion2`, `valoracion3`, `valoracion4`, `modificable1..4`, `imprimible1..4` payload fields (VTC-2); ensure other tabs remain (VTC-3)
- Run `pnpm --filter web test` + `pnpm --filter web lint` → GREEN

### 2a-T2 — New component: CourseCycleSubjectSelector [x]
- **RED**: write failing tests in `web/src/pages/dashboard/__tests__/course-cycle-subject-selector.test.tsx` (NEW) for CCSS-1 (full emit), CCSS-2 (AcademicCycle reset), CCSS-3 (CourseCycle reset), CCSS-4 (loading state), CCSS-5 (empty state), CCSS-6 (error + retry), CCSS-7 (no partial emit)
- **File**: `web/src/pages/dashboard/components/CourseCycleSubjectSelector.tsx` (NEW)
- Controlled 3-level cascade: Level 1 = AcademicCycle (fetch from `GET /v1/academic-cycles`), Level 2 = CourseCycle (`GET /v1/course-cycles?academicCycleId=`), Level 3 = Subject (`GET /v1/study-plans/:studyPlanId/subjects` or equivalent)
- On AcademicCycle change: reset courseCycleId + subjectId (CCSS-2)
- On CourseCycle change: reset subjectId; read `level` + `modality` from `GET /v1/course-cycles/:uuid` response (CCSS-3); read `studyPlanId` from cycle
- Each dropdown: `aria-disabled`/`aria-busy` for a11y (CCSS a11y requirement); loading indicator; empty-state message; error indicator + retry affordance
- Emit `{ courseCycleId, studyPlanId, studyPlanSubjectId, level, modality }` only when all 3 levels selected (CCSS-1, CCSS-7)
- Pattern: follow `PlanCourseSubjectSelector` and `grading-scales.tsx` ROOT institution-selector conventions
- Run `pnpm --filter web test` + `pnpm --filter web lint` → GREEN

### 2a-T3 — New page shell: competency-grading.tsx [x]
- **RED**: write failing smoke test in `web/src/pages/dashboard/__tests__/competency-grading.test.tsx` (NEW) asserting page renders selector and a grid placeholder slot; renders without crashing
- **File**: `web/src/pages/dashboard/competency-grading.tsx` (NEW)
- Render `CourseCycleSubjectSelector`; when selector emits, store the context and pass to `CompetencyGradingGrid` slot (placeholder for PR 2b — render null/loading until grid lands); apply ROOT institution guard if needed (mirror pattern from grading-scales.tsx)
- Run `pnpm --filter web test` → GREEN

### 2a-T4 — Route: add /competency-grading to App.tsx [x]
- **File**: `web/src/App.tsx`
- Add `<Route path="/competency-grading" element={<CompetencyGradingPage />} />` inside the existing dashboard/protected route tree (mirror the pattern used for `/grading-scales`, `/grading-periods`)
- No dedicated test needed beyond the smoke test in 2a-T3; lint check
- Run `pnpm --filter web lint` → GREEN

### 2a-T5 — Sidebar entry: "Calificación de Competencias" [x]
- **File**: `web/src/components/layout/sidebar.tsx`
- Add "Calificación de Competencias" entry under the Académico section, linking to `/competency-grading` (mirror "Escalas de Calificación" / "Períodos de Calificación" entries)
- Run `pnpm --filter web lint` → GREEN

---

## PR 2b — Frontend: Grading Grid + Save Logic (~390 lines)

**Satisfies**: CGG-1–12 (full grid scenarios)  
**Dependencies**: PR 2a merged  
**Parallelism**: 2b-T1 (shared helper) independent; 2b-T2 (state model + hook) can follow; 2b-T3 (grid component) requires 2b-T1 + 2b-T2; 2b-T4 (save logic) requires 2b-T3; 2b-T5 (wire into page) requires 2b-T3 + 2b-T4.

### 2b-T1 — Shared helper: internalStatusColor + internalStatusLabel [x]
- **RED**: write failing unit test in `web/src/pages/dashboard/__tests__/grading-status.test.ts` (NEW) asserting each status returns the correct CSS variable: APROBADO=`var(--color-success)`, NO_APROBADO=`var(--color-danger)`, EN_PROCESO=`var(--color-warning, #f59e0b)`, LIBRE=`var(--color-text-muted)`, null=undefined/null (D2, CGG-4)
- **File**: `web/src/pages/dashboard/components/grading-status.ts` (NEW)
- Extract `internalStatusColor(status: string | null): string | undefined` and `internalStatusLabel(status: string | null): string | undefined` from `grading-scales.tsx:668-672` color map verbatim; reuse `INTERNAL_STATUS_LABELS` from same source
- Run `pnpm --filter web test` → GREEN

### 2b-T2 — Grid state model + data hook: useGradingGrid [x]
- **RED**: write failing tests in `web/src/pages/dashboard/__tests__/use-grading-grid.test.ts` (NEW):
  - Hook fires 5 parallel fetches on mount (students, subject-competencies, period-templates, scales, bulk-valuations)
  - `activePeriodItemId` defaults to first period item
  - `cells` Map keyed `${valuationId}:${periodItemId}` holds correct `CellState` after data loads
  - `switchPeriod()` updates `activePeriodItemId` without refetch (CGG-2)
- **File**: `web/src/pages/dashboard/components/use-grading-grid.ts` (NEW)
- Define `CellState { valuationId, studentId, competencyId, periodItemId, gradeScaleValueId, gradeCode, internalStatus, modificable, saveState: 'idle'|'dirty'|'saving'|'error' }`
- Define `cells: Map<string, CellState>` state; parallel `Promise.allSettled` over 5 fetches → single loading gate (CGG-12); derive cells from loaded data
- Export `switchPeriod(periodItemId)` → update `activePeriodItemId`, re-derive visible cells from already-loaded data (no new fetch)
- Run `pnpm --filter web test` → GREEN

### 2b-T3 — Grid component: CompetencyGradingGrid (matrix, period nav, locked cells, badges) [x]
- **RED**: write failing tests in `web/src/pages/dashboard/__tests__/competency-grading-grid.test.tsx` (NEW):
  - CGG-1: renders rows × cols matrix with existing grade in correct cell
  - CGG-2: period nav switches visible cell values from loaded data
  - CGG-3: `modificable=false` cell → disabled dropdown + lock icon; no PATCH issued
  - CGG-4: badge colors from `internalStatusColor` helper (each status value)
  - CGG-8: no students → empty-state message
  - CGG-9: no competencies → empty-state message
  - CGG-10: no period template → empty-state message
  - CGG-11: no grade scale → empty-state message + no dropdown options
  - CGG-12: loading state while fetches in-flight
- **File**: `web/src/pages/dashboard/components/CompetencyGradingGrid.tsx` (NEW)
- Accepts `{ courseCycleId, studyPlanId, studyPlanSubjectId, level, modality }` props; uses `useGradingGrid` hook
- Renders fixed-period matrix: rows = students, columns = competencies, cells = `GradeScaleValue` dropdown for `activePeriodItemId`
- Period navigation tabs/selector: calls `switchPeriod()` on change
- Locked cells: `disabled` attribute + lock icon (e.g. LockIcon); no PATCH on locked cell (CGG-3)
- `internalStatus` badge via `internalStatusColor` + `internalStatusLabel` (CGG-4); null → no badge
- Per-cell loading/empty/error states following ui-patterns rule
- Run `pnpm --filter web test` + `pnpm --filter web lint` → GREEN

### 2b-T4 — Save logic: per-cell PATCH + "Guardar todo" (bounded-parallel allSettled) [x]
- **RED**: extend tests in `web/src/pages/dashboard/__tests__/competency-grading-grid.test.tsx`:
  - CGG-5: dropdown change → PATCH issued; on 200 cell updates to new value, `saveState='idle'`
  - CGG-6: PATCH failure → `saveState='error'`, error indicator visible, dirty value preserved for retry
  - CGG-7: "Guardar todo" issues one PATCH per dirty/error cell; on all-success all dirty flags cleared
  - D3: "Guardar todo" runs bounded-parallel (≤5 in-flight via `Promise.allSettled`)
- **Files**: `web/src/pages/dashboard/components/use-grading-grid.ts`, `web/src/pages/dashboard/components/CompetencyGradingGrid.tsx`
- In hook: `updateCell(cellKey, gradeScaleValueId)` → set `dirty`, fire `PATCH /v1/competency-valuations/:valuationId/periods/:periodItemId`; optimistic `saving` state → on 200 merge updated `gradeCode`+`internalStatus` from response, set `idle`; on non-2xx set `error`
- `saveAll()`: collect all cells where `saveState === 'dirty' || 'error'`; chunk into batches of 5; `Promise.allSettled` per batch; update each cell result individually (CGG-7, D3)
- In component: wire dropdown `onChange` to `updateCell`; "Guardar todo" button calls `saveAll()` (disabled while any cell `saving`)
- Run `pnpm --filter web test` + `pnpm --filter web lint` → GREEN

### 2b-T5 — Wire grid into competency-grading.tsx page [x]
- **File**: `web/src/pages/dashboard/competency-grading.tsx`
- Replace placeholder slot with `<CompetencyGradingGrid {...selectionContext} />` when selector has emitted; keep selector always visible; import + wire
- Run `pnpm --filter web test` + `pnpm --filter web lint` → GREEN

---

## Cross-Cutting: Build Verification

After each PR's final task, run build smoke before merge PR:
- **Backend PRs (1a, 1b)**: `pnpm --filter domain build` then `pnpm --filter api build`
- **Frontend PRs (2a, 2b)**: `pnpm --filter web build` (type check)

Conventional commits: `feat(grading): ...`, `test(grading): ...`, `refactor(grading): ...` — one commit per PR.

---

## Review Workload Forecast

| PR | Scope | ~Prod Lines | ~Test Lines | Total | 400-line budget |
|----|-------|-------------|-------------|-------|-----------------|
| 1a | bulk-valuations-read backend | ~135 | ~140 | ~275 | OK |
| 1b | students-by-cycle + modality | ~130 | ~100 | ~230 | OK |
| 2a | selector + page shell + cleanup | ~270 net new | ~90 | ~360 | OK |
| 2b | grid + save logic | ~390 | ~130 | ~520 | HIGH — keep isolated |

**Chained PRs recommended: Yes**  
**Decision resolved: 4 chained PRs (1a → 1b → 2a → 2b)**  
**400-line budget risk**: PR 2b HIGH (grid is complex; keeping it isolated is the mitigation).  

PR 2b exceeds 400 lines total. Mitigation: the PR is focused on one component + one hook — a reviewer can read it as a unit. If the team enforces the hard budget, split 2b into 2b-matrix (T1–T3, display only) and 2b-save (T4–T5, save logic).
