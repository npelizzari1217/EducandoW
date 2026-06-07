# Tasks: study-plan-safe-delete

16 tasks across 6 groups. Groups A→B→C→D are strictly sequential (domain gates infra, infra gates app, app gates presentation). Group E runs in parallel with Groups B–D (starts after A6). Group F is final verification.

---

## Group A — Domain Package (sequential, hard gate before all api layers)

### A1 [TEST — RED] Write failing error test
- **File**: `packages/domain/src/pedagogy/__tests__/errors/study-plan.errors.test.ts` (NEW)
- **Spec**: REQ-1–REQ-7 (orchestrator override: message built in constructor, not controller)
- **Cases**:
  - `code === 'STUDY_PLAN_HAS_DEPENDENCIES'`
  - `courseCount` and `courseCycleCount` fields stored on instance
  - `format_message(1,0)` → "No se puede eliminar el plan de estudio porque tiene 1 curso vinculado. Eliminá los cursos vinculados antes de continuar."
  - `format_message(3,0)` → "...3 cursos vinculados..."
  - `format_message(0,1)` → "...1 ciclo lectivo activo..."
  - `format_message(0,2)` → "...2 ciclos lectivos activos..."
  - `format_message(2,1)` → "...2 cursos vinculados y 1 ciclo lectivo activo..."
  - `format_message(1,2)` → "...1 curso vinculado y 2 ciclos lectivos activos..."
- **Run**: `pnpm --filter @educandow/domain test` → RED

### A2 [IMPLEMENT] Create StudyPlanHasDependenciesError
- **File**: `packages/domain/src/pedagogy/errors/study-plan.errors.ts` (NEW)
- Private `buildMessage(courseCount, courseCycleCount)` implementing REQ-7 Templates A/B/C (Rioplatense voseo)
- `StudyPlanHasDependenciesError extends DomainError` with constructor storing `public readonly courseCount` and `public readonly courseCycleCount`, calling `super(buildMessage(...), 'STUDY_PLAN_HAS_DEPENDENCIES')`
- Pattern mirrors `CycleCodeAlreadyExistsError` in `academic-cycle.errors.ts`
- **Run**: `pnpm --filter @educandow/domain test` → GREEN

### A3 [EXPORT] Extend pedagogy barrel
- **File**: `packages/domain/src/pedagogy/index.ts`
- Add: `export { StudyPlanHasDependenciesError } from './errors/study-plan.errors';`

### A4 [EXPORT] Extend root domain barrel
- **File**: `packages/domain/src/index.ts`
- Add: `export { StudyPlanHasDependenciesError } from './pedagogy';`

### A5 [PORT] Add getDependencies to repository interface
- **File**: `packages/domain/src/pedagogy/repositories/study-plan-repository.ts`
- Add: `getDependencies(planId: string): Promise<{ courseCount: number; courseCycleCount: number }>;`
- **Spec**: REQ-8

### A6 [BUILD — HARD GATE] Rebuild domain package
- **Command**: `pnpm --filter @educandow/domain build`
- Regenerates `dist/` so api resolves new exports. Skipping this causes TypeScript "no exported member" errors. Do not proceed to Group B or E until this passes.

---

## Group B — Infrastructure (after A6; can run parallel with Group E)

### B1 [TEST — RED] Extend Prisma repository test with getDependencies cases
- **File**: `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-study-plan.repository.test.ts` (extend existing)
- Add new `describe('PrismaStudyPlanRepository — getDependencies', ...)` block:
  - counts ALL `studyPlanCourse` rows by `studyPlanId` (no deletedAt filter — junction has none)
  - counts only `courseCycle` rows where `studyPlanId = planId` AND `deletedAt = null` (REQ-8 Scenario 8.1: soft-deleted cycles excluded)
  - returns `{ courseCount: 0, courseCycleCount: 0 }` when no rows exist
- **Run**: `pnpm --filter api test` → RED

### B2 [IMPLEMENT] Add getDependencies to PrismaStudyPlanRepository
- **File**: `api/src/infrastructure/persistence/prisma/repositories/prisma-study-plan.repository.ts`
- Implementation: `const [courseCount, courseCycleCount] = await Promise.all([this.client.studyPlanCourse.count({ where: { studyPlanId: planId } }), this.client.courseCycle.count({ where: { studyPlanId: planId, deletedAt: null } })]); return { courseCount, courseCycleCount };`
- No `$transaction` needed (two independent counts; non-transactional acceptable for admin low-concurrency)
- **Run**: `pnpm --filter api test` → GREEN

---

## Group C — Application Use Case (after B2)

### C1 [TEST — RED] Extend UC test with DeleteStudyPlanUC describe block
- **File**: `api/src/application/pedagogy/__tests__/study-plan.use-cases.test.ts` (extend existing)
- Add `getDependencies: vi.fn()` to the existing `mockRepo` object at top of file
- Import `DeleteStudyPlanUC` and `StudyPlanHasDependenciesError`
- Add `describe('DeleteStudyPlanUC', ...)` with cases:
  - blocked by courses only: `getDependencies` returns `{courseCount:2, courseCycleCount:0}` → `result.isErr()`, `result.unwrapErr() instanceof StudyPlanHasDependenciesError`, `softDelete` NOT called
  - blocked by cycles only: `{courseCount:0, courseCycleCount:1}` → `result.isErr()`, `softDelete` NOT called
  - blocked by both: `{courseCount:1, courseCycleCount:1}` → `result.isErr()`, `softDelete` NOT called
  - ok — no deps: `{courseCount:0, courseCycleCount:0}` → `result.isOk()`, `softDelete` called once with plan id
  - not found: `findById` returns null → `result.isOk()`, `getDependencies` NOT called, `softDelete` NOT called
- **Spec**: REQ-1–REQ-5
- **Run**: `pnpm --filter api test` → RED

### C2 [IMPLEMENT] Rewrite DeleteStudyPlanUC
- **File**: `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` (line 387 — replace one-liner)
- New return type: `Promise<Result<void, DomainError>>`
- Logic:
  ```
  async execute(id: string): Promise<Result<void, DomainError>> {
    const existing = await this.r.findById(id);
    if (!existing) return ok(undefined);
    const { courseCount, courseCycleCount } = await this.r.getDependencies(id);
    if (courseCount > 0 || courseCycleCount > 0)
      return err(new StudyPlanHasDependenciesError(courseCount, courseCycleCount));
    await this.r.softDelete(id);
    return ok(undefined);
  }
  ```
- Add imports: `Result`, `DomainError`, `StudyPlanHasDependenciesError` from `@educandow/domain`
- **Run**: `pnpm --filter api test` → GREEN

---

## Group D — Presentation Controller (after C2)

### D1 [TEST — RED] Create controller unit test (thin)
- **File**: `api/src/presentation/pedagogy/__tests__/study-plan.controller.test.ts` (NEW)
- Mock `DeleteStudyPlanUC`; two cases:
  - UC returns `err(new StudyPlanHasDependenciesError(1,0))` → controller throws `HttpException` with status 409, body `{ error: { message: <string>, code: 'STUDY_PLAN_HAS_DEPENDENCIES', details: { courseCount: 1, courseCycleCount: 0 } } }`
  - UC returns `ok(undefined)` → no exception thrown
- **Spec**: REQ-6
- **Run**: `pnpm --filter api test` → RED

### D2 [IMPLEMENT] Update deletePlan controller method
- **File**: `api/src/presentation/pedagogy/pedagogy.controller.ts` (line 283-284)
- Replace one-liner with:
  ```
  const r = await this.deletePlanUC.execute(id);
  if (r.isErr()) {
    const e = r.unwrapErr();
    if (e instanceof StudyPlanHasDependenciesError)
      throw new HttpException(
        { error: { message: e.message, code: e.code, details: { courseCount: e.courseCount, courseCycleCount: e.courseCycleCount } } },
        HttpStatus.CONFLICT,
      );
    throw new HttpException({ error: { message: e.message, code: e.code } }, HttpStatus.BAD_REQUEST);
  }
  ```
- Import `StudyPlanHasDependenciesError` from `@educandow/domain`
- **Run**: `pnpm --filter api test` → GREEN

---

## Group E — Frontend (after A6; can run parallel with Groups B–D)

### E1 [TEST — RED] Write AlertModal component test
- **File**: `web/src/components/ui/__tests__/alert-modal.test.tsx` (NEW)
- Vitest + React Testing Library (matches existing `level-checkbox-group.test.tsx` setup)
- Cases:
  - `open={false}` → nothing rendered (query for role="dialog" or overlay element returns null)
  - `open={true}` → title text visible, message text visible
  - "Aceptar" button click → `onClose` called once
  - backdrop click → `onClose` called once
- **Spec**: REQ-9.1, REQ-9.2
- **Run**: `pnpm --filter web test` → RED

### E2 [IMPLEMENT] Create AlertModal component
- **File**: `web/src/components/ui/alert-modal.tsx` (NEW)
- Props: `{ open: boolean; title: string; message: string; onClose: () => void }`
- Return `null` when `!open`
- Fixed overlay: `position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:1000`; clicking overlay calls `onClose`
- Inner Card: `max-width:420px; width:90%`; `var(--shadow-xl)`; `var(--radius-lg)`; warning accent via `var(--color-warning)` / `var(--color-warning-light)` + warning glyph/icon
- Single primary "Aceptar" `Button` → `onClose`; no Cancel button
- **Run**: `pnpm --filter web test` → GREEN

### E3 [INTEGRATE] Update handleDeletePlan in study-plans.tsx
- **File**: `web/src/pages/dashboard/study-plans.tsx`
- Add state: `const [alertModal, setAlertModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' })`
- Rewrite `handleDeletePlan`: do NOT call `del(id)` from `useApiDelete` (that hook swallows errors). Call `apiClient.delete(\`/study-plans/${id}\`, { params: tenantQueryParams })` directly inside `try/catch`:
  - success → `reload()`
  - catch → `setAlertModal({ open: true, message: extractErrorMessage(e) })` — NO `reload()`
- Imports to add: `AlertModal` from `'../../components/ui/alert-modal'`; `extractErrorMessage` from `'../../hooks/use-api'`
- Add to JSX: `<AlertModal open={alertModal.open} title="No se puede eliminar" message={alertModal.message} onClose={() => setAlertModal(p => ({ ...p, open: false }))} />`
- **Spec**: REQ-9

---

## Group F — Final Verification (after D2 and E3)

### F1 [VERIFY] Full test + typecheck + lint suite
- `pnpm --filter @educandow/domain test` → all green
- `pnpm --filter api test` → all green (6 pre-existing failures expected: postgres-admin, ensure-institution-levels)
- `pnpm --filter web test` → all green
- `pnpm --filter api typecheck` → zero errors
- `pnpm --filter api lint` → zero errors
- `pnpm --filter web lint` → zero errors

---

## Dependency Graph

```
A1→A2→A3→A4→A5→A6 ──┬──► B1→B2→C1→C2→D1→D2 ──┐
                      │                            ├──► F1
                      └──► E1→E2→E3 ──────────────┘
```

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| New files | 5 |
| Modified files | 9 |
| Total files touched | 14 |
| Estimated changed lines (net) | ~340 |
| 400-line budget risk | Medium |
| Chained/stacked PRs recommended | No |
| Decision needed before apply | No |

Artifact store: HYBRID
File: openspec/changes/study-plan-safe-delete/tasks.md
Project: educandow
Topic: sdd/study-plan-safe-delete/tasks
