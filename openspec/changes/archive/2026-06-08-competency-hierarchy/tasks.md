# Tasks — competency-hierarchy (Fase 2)

Delivery strategy: **chained PRs** (4 slices, user-approved).
Strict TDD: each logical unit follows RED → GREEN order.
Test runners: `pnpm --filter domain test` | `pnpm --filter api test` | `pnpm --filter web test`.

---

## PR1 — Domain + Schema + Migration (~170 lines)
**Foundation. Must compile and all domain tests must be green before PR2 starts.**
Sequential. No other PR can merge before this one.

### T1.1 [x] Domain entity + port tests
- File: `packages/domain/src/pedagogy/__tests__/entities/competency.test.ts`
- Spec ref: Spec 1 §Scenarios (construction, duplicate, cascade, repo found/not-found)
- Write / update test cases for:
  - `SubjectCompetency.create({ studyPlanSubjectId, name })` → entity with correct fields
  - Entity exposes `studyPlanSubjectId`, does NOT expose `subjectId` or `periodActive`
  - Duplicate name within same `studyPlanSubjectId` is detectable (repo-level scenario)
  - Port method signatures compile: `findActiveByStudyPlanSubject`, `findByStudyPlanSubjectAndName`, `findByStudyPlanSubject`
  - Port method signature compiles: `findStudyPlanSubjectIds` on `StudyPlanRepository`
  - Port method signature compiles: `findByStudentAndStudyPlanSubject` on `CompetencyValuationRepository`
- Run `pnpm --filter domain test` → RED expected (entity/ports don't match yet)

### T1.2 [x] Update domain entity
- File: `packages/domain/src/pedagogy/entities/subject-competency.ts`
- Swap `subjectId: string` → `studyPlanSubjectId: string`
- Remove `periodActive` field, getter, `setPeriodActive` method
- Update `create()` factory accordingly

### T1.3 [x] Update SubjectCompetencyRepository port
- File: `packages/domain/src/pedagogy/repositories/subject-competency-repository.ts`
- Add: `findActiveByStudyPlanSubject(studyPlanSubjectId: string): Promise<SubjectCompetency[]>`
- Add: `findByStudyPlanSubjectAndName(studyPlanSubjectId: string, name: string): Promise<SubjectCompetency | null>`
- Add: `findByStudyPlanSubject(studyPlanSubjectId: string): Promise<SubjectCompetency[]>`
- Remove: `findActiveBySubject`, `findBySubjectAndName` (old subjectId-scoped methods)

### T1.4 [x] Update CompetencyValuationRepository port
- File: `packages/domain/src/pedagogy/repositories/competency-valuation-repository.ts`
- Rename: `findByStudentAndSubject` → `findByStudentAndStudyPlanSubject(studentId, studyPlanSubjectId)`

### T1.5 [x] Update StudyPlanRepository port
- File: `packages/domain/src/pedagogy/repositories/study-plan-repository.ts`
- Add: `findStudyPlanSubjectIds(courseSectionId: string, subjectId: string): Promise<string[]>`

### T1.6 [x] Remodel schema.prisma
- File: `api/prisma_tenant/schema.prisma`
- On `SubjectCompetency` model:
  - Remove field `subjectId`, its `Subject` relation, `@@unique([subjectId, name])`, `@@index([subjectId])`
  - Remove field `periodActive`
  - Add `studyPlanSubjectId  String`
  - Add relation `studyPlanSubject  StudyPlanSubject  @relation(fields:[studyPlanSubjectId], references:[id], onDelete: Cascade)`
  - Add `@@unique([studyPlanSubjectId, name])`
  - Add `@@index([studyPlanSubjectId])`
- On `StudyPlanSubject` model: add back-relation `competencies SubjectCompetency[]`
- On `Subject` model: remove `competencies SubjectCompetency[]` back-relation
- On `CompetencyValuation` model: add Fase-3 marker comment on `@@unique([studentId, competencyId])`:
  `// @fase3: add courseCycleId → UNIQUE(studentId, competencyId, courseCycleId) before populating multi-cycle data`

### T1.7 [x] Write destructive migration SQL
- File: `api/prisma_tenant/migrations/<ts>_competency_scope_remodel/migration.sql`
  (generate timestamp, e.g. `20260608000000_competency_scope_remodel`)
- Must include header comment: `-- DESTRUCTIVE RESET: competency_valuations + subject_competencies cleared`
  `-- Safe only because tables are near-empty (Fase 2 pre-production). No down-migration.`
- Sequence (FK order):
  1. `TRUNCATE TABLE "competency_valuations" RESTART IDENTITY CASCADE;`
  2. `TRUNCATE TABLE "subject_competencies" RESTART IDENTITY CASCADE;`
  3. `ALTER TABLE "subject_competencies" DROP CONSTRAINT FK_subject, DROP COLUMN "subject_id", DROP COLUMN "period_active";`
  4. `ALTER TABLE "subject_competencies" ADD COLUMN "study_plan_subject_id" TEXT NOT NULL;`
  5. `ALTER TABLE "subject_competencies" ADD CONSTRAINT FK_study_plan_subject FOREIGN KEY ("study_plan_subject_id") REFERENCES "study_plan_subjects"("id") ON DELETE CASCADE;`
  6. `ALTER TABLE "subject_competencies" ADD CONSTRAINT UQ_sps_name UNIQUE ("study_plan_subject_id", "name");`
  7. `CREATE INDEX IF NOT EXISTS "subject_competencies_study_plan_subject_id_idx" ON "subject_competencies"("study_plan_subject_id");`
- Confirm exact column/table names match Prisma's snake_case output before applying

### T1.8 [x] Run domain tests
- Command: `pnpm --filter domain test`
- Must be fully green before opening PR1
- No TypeScript compile errors allowed (TS type errors here cascade to PR2+)

---

## PR2 — Infrastructure + Application + Wiring + Tests (~300 lines)
**Depends on PR1 merged.** Backend complete. All API logic testable without HTTP.
Sequential after PR1. Internal task order: RED (T2.1) → GREEN (T2.2–T2.6) → GATE (T2.7).

### T2.1 [x] Application use-case tests
- File: `application/pedagogy/__tests__/competency.use-cases.test.ts`
- Spec ref: Spec 1 §Scenarios, Spec 2 §Scenarios, Spec 3 (copy scenarios), Spec 3 (list valuation rename)
- Write/reshape mocks for `studyPlanSubjectId` (remove `subjectId`, `periodActive` from all stubs)
- Tests for `CreateSubjectCompetencyUC.execute({ studyPlanSubjectId, name })`:
  - Happy path → entity created + saved
  - Missing `studyPlanSubjectId` → ValidationError
- Tests for `ListSubjectCompetenciesUC.execute({ studyPlanSubjectId })`:
  - Happy path → returns list from repo
- Tests for `AutoCreateCompetencyValuationsUC.executeForSubjectAssignment`:
  - Happy path: `findStudyPlanSubjectIds` returns ids → competencies loaded → valuations created
  - No StudyPlanSubject found → `findStudyPlanSubjectIds` returns [] → no-op, returns ok
  - Zero competencies → no-op, returns ok
  - Idempotency: existing valuation found → skip (bulkCreate skipDuplicates OR per-item check)
  - AutoCreate throws → assignment UC still returns success (isolation test)
- Tests for `AutoCreateCompetencyValuationsUC.executeForEnrollment` via hierarchy
- Tests for `CopySubjectCompetenciesUC.execute`:
  - Happy path `{ sourceStudyPlanSubjectId, targetStudyPlanSubjectId }` → `{ copied: N, skipped: 0 }`
  - Partial (some names in target) → `{ copied: M, skipped: K }`
  - Zero source competencies → `{ copied: 0, skipped: 0 }` (no error)
  - `source === target` → ValidationError
  - Missing either id → ValidationError
- Tests for `ListCompetencyValuationsUC.execute({ studentId, studyPlanSubjectId })`:
  - Param rename from `subjectId` → `studyPlanSubjectId` flows to repo call
- Run `pnpm --filter api test` → RED expected

### T2.2 [x] Update prisma-subject-competency.repository.ts
- File: `infrastructure/pedagogy/repositories/prisma-subject-competency.repository.ts` (verify path)
- All Prisma queries: `subjectId` → `studyPlanSubjectId`
- Drop `periodActive` from `create()` call and `toDomain()` mapper
- Implement `findActiveByStudyPlanSubject(studyPlanSubjectId)`: `findMany({ where: { studyPlanSubjectId, deletedAt: null } })`
- Implement `findByStudyPlanSubjectAndName(studyPlanSubjectId, name)`: `findFirst({ where: { studyPlanSubjectId, name, deletedAt: null } })`
- Implement `findByStudyPlanSubject(studyPlanSubjectId)`: `findMany({ where: { studyPlanSubjectId } })` (includes soft-deleted, for copy idempotency check)
- Remove implementations of `findActiveBySubject`, `findBySubjectAndName`

### T2.3 [x] Update prisma-competency-valuation.repository.ts
- File: `infrastructure/pedagogy/repositories/prisma-competency-valuation.repository.ts` (verify path)
- Rename method `findByStudentAndSubject` → `findByStudentAndStudyPlanSubject(studentId, studyPlanSubjectId)`
- Change first query filter from `subjectId` to `studyPlanSubjectId`:
  ```ts
  const ids = await client.subjectCompetency.findMany({
    where: { studyPlanSubjectId, deletedAt: null }, select: { id: true },
  });
  ```
  Second query unchanged (filter by `competencyId in [...]`)

### T2.4 [x] Implement findStudyPlanSubjectIds in prisma-study-plan.repository.ts
- File: `infrastructure/pedagogy/repositories/prisma-study-plan.repository.ts` (verify path)
- Implement `findStudyPlanSubjectIds(courseSectionId, subjectId): Promise<string[]>`:
  ```ts
  const rows = await client.studyPlanSubject.findMany({
    where: {
      studyPlanCourse: { courseSectionId },
      subjectId,
    },
    select: { id: true },
  });
  return rows.map(r => r.id);
  ```
  (A courseSection may belong to multiple plans → multiple rows; all ids returned)

### T2.5 [x] Update competency.use-cases.ts
- File: `application/pedagogy/use-cases/competency.use-cases.ts` (verify path)
- `CreateSubjectCompetencyUC`: accept `studyPlanSubjectId`, drop `periodActive`
- `ListSubjectCompetenciesUC`: param `studyPlanSubjectId` (from `subjectId`)
- `AutoCreateCompetencyValuationsUC`:
  - Add `StudyPlanRepository` to constructor dependencies
  - `executeForSubjectAssignment(subjectId, courseSectionId)`:
    1. `spsIds = await studyPlanRepo.findStudyPlanSubjectIds(courseSectionId, subjectId)`
    2. If empty → return (no-op)
    3. `competencies = flatten(await Promise.all(spsIds.map(id => competencyRepo.findActiveByStudyPlanSubject(id))))`
    4. If empty → return (no-op)
    5. `studentIds = await findEnrolledStudentIds(courseSectionId)` (unchanged)
    6. Build + bulkCreate valuations (idempotent via skipDuplicates)
  - `executeForEnrollment`: same hierarchy navigation per assignment
  - Remove old `findActiveBySubject` calls
- `ListCompetencyValuationsUC`: rename param `subjectId` → `studyPlanSubjectId`; pass to `findByStudentAndStudyPlanSubject`
- New `CopySubjectCompetenciesUC` (single class, single `execute()`):
  ```
  execute({ sourceStudyPlanSubjectId, targetStudyPlanSubjectId }):
    validate both present AND source !== target → else ValidationError
    sources = findActiveByStudyPlanSubject(source)
    for each c in sources:
      existing = findByStudyPlanSubjectAndName(target, c.name)
      if existing → skipped++ else create+save → copied++
    return Result.ok({ copied, skipped })
  ```

### T2.6 [x] Wire pedagogy.module.ts
- File: `presentation/pedagogy/pedagogy.module.ts` (verify path)
- Add `CopySubjectCompetenciesUC` to providers array
- Inject `StudyPlanRepository` token into `AutoCreateCompetencyValuationsUC` provider factory
- Ensure `StudyPlanRepository` symbol is imported and its impl is in the module (or imported from the plan module)

### T2.7 [x] Run API tests
- Command: `pnpm --filter api test`
- Must be fully green before opening PR2
- TypeScript compilation must be clean (PR3 depends on these types)

---

## PR3 — Presentation API (~60 lines)
**Depends on PR2 merged. Thin controllers + DTOs only.**
Note: PR2+PR3 may be combined (~360 lines) if reviewer approves. Keep as separate commits.
Sequential after PR2. Internal order: RED (T3.1) → GREEN (T3.2–T3.3) → GATE (T3.4).

### T3.1 [x] DTO validation + controller route tests
- File: `presentation/pedagogy/__tests__/competency.controller.spec.ts` (or equivalent, verify path)
- Spec ref: Spec 3 §Validation scenarios
- Tests (validation → HTTP 400 per project convention):
  - `GET /subject-competencies` without `studyPlanSubjectId` → 400
  - `POST /subject-competencies` with `subjectId` instead of `studyPlanSubjectId` → 400
  - `POST /subject-competencies` missing `name` → 400
  - `POST /subject-competencies/copy` missing `sourceStudyPlanSubjectId` → 400
  - `POST /subject-competencies/copy` missing `targetStudyPlanSubjectId` → 400
  - `GET /competency-valuations` without `studyPlanSubjectId` → 400
  - `POST /subject-competencies/copy` happy path → 200 `{ copied: N, skipped: M }`
- Run `pnpm --filter api test` → RED for new copy route + validation cases

### T3.2 [x] Update competency.dto.ts
- File: `presentation/pedagogy/dto/competency.dto.ts` (verify path)
- `CreateSubjectCompetencySchema`: replace `subjectId` with `studyPlanSubjectId` (required string), remove `periodActive`
- `UpdateSubjectCompetencySchema`: remove `periodActive` field
- New `CopySubjectCompetenciesSchema`: `{ sourceStudyPlanSubjectId: string (required), targetStudyPlanSubjectId: string (required) }`

### T3.3 [x] Update pedagogy.controller.ts
- File: `presentation/pedagogy/pedagogy.controller.ts` (verify path)
- `GET /subject-competencies`: query param `studyPlanSubjectId` (required, validate → 400); call `ListSubjectCompetenciesUC`
- `POST /subject-competencies`: body `{ studyPlanSubjectId, name }` (validate → 400); call `CreateSubjectCompetencyUC`
- `PATCH /subject-competencies/:id`: body drops `periodActive`; responses drop `periodActive`
- `POST /subject-competencies/copy`: new route with `CopySubjectCompetenciesSchema` body (validate → 400); call `CopySubjectCompetenciesUC`; return `200 { copied, skipped }`
- `GET /competency-valuations`: query params `studentId` + `studyPlanSubjectId` (both required, validate → 400); call `ListCompetencyValuationsUC`
- Route ordering: `POST /subject-competencies/copy` must be declared BEFORE `/:id` parameterized routes to avoid NestJS routing ambiguity

### T3.4 [x] Run API tests
- Command: `pnpm --filter api test`
- Must be fully green
- Confirm no `periodActive` leaks in response shape

---

## PR4 — Web UI (~250 lines)
**Depends on PR3 merged.** UI repair + drill-down + copy dialog.
Sequential after PR3. Internal order: RED (T4.1) → GREEN (T4.2–T4.4) → GATE (T4.5).

### T4.1 [x] Web component tests
- Files: new test files alongside each component (verify project test convention for web)
- Spec ref: Spec 4 §Scenarios (all 10)
- `PlanCourseSubjectSelector` tests:
  - Renders plan dropdown on mount, calls `GET /study-plans`
  - Selecting a plan calls `GET /study-plans/:id/courses` and populates course dropdown
  - Selecting a course populates subject dropdown from inline `subjects[]`
  - Changing plan resets course + subject selections
  - Changing course resets subject selection
- `CopyCompetenciesDialog` tests:
  - Renders source drill-down selector
  - Confirm calls `POST /subject-competencies/copy`
  - On success: refreshes Tab 1 list
  - Shows `{ copied, skipped }` feedback
  - Shows zero-results message when `copied === 0 && skipped === 0`
- `competencies.tsx` tests:
  - Tab 1: calls `/subject-competencies?studyPlanSubjectId=` (NOT dead `/subjects/:id/competencies`)
  - Tab 2: calls `/competency-valuations?studentId=&studyPlanSubjectId=` (NOT dead `/students/:id/competency-valuations`)
  - Copy button visible on Tab 1
- Run `pnpm --filter web test` → RED expected

### T4.2 [x] Create PlanCourseSubjectSelector.tsx
- File: `web/src/pages/dashboard/components/PlanCourseSubjectSelector.tsx` (new)
- Props: `onSubjectSelect: (studyPlanSubjectId: string) => void`
- On mount: `GET /study-plans` → populate plan `<select>`
- On plan select: `GET /study-plans/:id/courses` → populate course `<select>` (inline `subjects[]` stored)
- On course select: populate subject `<select>` from stored `subjects[]` (no extra fetch)
- On upstream change: cascade reset (plan change → clear course + subject; course change → clear subject)
- Note: `course.subjects[].id` IS the `studyPlanSubjectId` (confirmed from `StudyPlanCourseDto`)

### T4.3 [x] Create CopyCompetenciesDialog.tsx
- File: `web/src/pages/dashboard/components/CopyCompetenciesDialog.tsx` (new)
- Props: `targetStudyPlanSubjectId: string; onSuccess: () => void; onClose: () => void`
- Renders its own `PlanCourseSubjectSelector` for source selection
- Confirm button: calls `POST /subject-competencies/copy { sourceStudyPlanSubjectId, targetStudyPlanSubjectId }`
- On success: call `onSuccess()` (triggers list refresh in parent) + show toast/inline feedback: `Copied ${copied}, skipped ${skipped}`
- If `copied === 0 && skipped === 0`: show "No competencies found in the source subject" message

### T4.4 [x] Rewrite competencies.tsx
- File: `web/src/pages/dashboard/competencies.tsx`
- Replace flat subject selector with `<PlanCourseSubjectSelector onSubjectSelect={setStudyPlanSubjectId} />`
- Tab 1:
  - Fetch: `GET /subject-competencies?studyPlanSubjectId=${studyPlanSubjectId}` (remove old `/subjects/:id/competencies` call)
  - Create form: body `{ studyPlanSubjectId, name }` (remove `subjectId`, `periodActive`)
  - Add "Copy from another course" button → renders `<CopyCompetenciesDialog targetStudyPlanSubjectId={studyPlanSubjectId} onSuccess={refetch} />`
- Tab 2:
  - Fetch: `GET /competency-valuations?studentId=${studentId}&studyPlanSubjectId=${studyPlanSubjectId}` (remove old `/students/:id/competency-valuations` call)
- Remove period selector UI (periodActive gone from SubjectCompetency)
- Remove all references to dead routes `/subjects/:id/competencies` and `/students/:id/competency-valuations`

### T4.5 [x] Run web tests
- Command: `pnpm --filter web test`
- Must be fully green
- Confirm: no dead route strings remain in competencies.tsx
- Confirm: `PlanCourseSubjectSelector` is used in Tab 1, Tab 2, and `CopyCompetenciesDialog` (DRY)

---

## Review Workload Forecast

| PR | Estimated lines | Chaining needed | Decision |
|----|-----------------|-----------------|----------|
| PR1 | ~170 | No (under 400) | Ship standalone (foundation) |
| PR2 | ~300 | Borderline | Ship standalone or merge with PR3 |
| PR3 | ~60 | No | Ship standalone or merge with PR2 |
| PR2+PR3 combined | ~360 | Borderline | Acceptable if reviewer approves |
| PR4 | ~250 | No | Ship standalone (different layer) |
| **Total** | **~665** | **Yes (full chain)** | **Already resolved: chained** |

- Chained PRs recommended: **Yes**
- 400-line budget risk: **High** for full change; managed by chaining
- Estimated total changed lines: ~665
- Decision needed before apply: **Already resolved** — chained (4 slices, user-approved)
- PR2+PR3 merge option: reviewer can approve combining into one ~360-line PR (one commit)

---

---

## PR-Fixbatch — Backend verify-report fixes (post-PR3 cleanup)
**Closes C1 + W1–W4 from verify-report-backend. No front-end changes.**

### TFB-C1 [x] UpdateSubjectCompetencyUC duplicate-name guard
- File: `api/src/application/pedagogy/use-cases/competency.use-cases.ts`
- Before saving a rename, call `findByStudyPlanSubjectAndName(existing.studyPlanSubjectId, trimmedName)`.
  Return `ValidationError` if sibling found (different id, not soft-deleted). Idempotent: same id → ok.
- Also: change not-found case from `ValidationError` → `NotFoundError` (enables W2 differentiation).
- Test: `competency.use-cases.test.ts` — `UpdateSubjectCompetencyUC` describe block (3 scenarios).

### TFB-W1 [x] POST /subject-competencies duplicate → HTTP 400 (was 409)
- File: `api/src/presentation/pedagogy/pedagogy.controller.ts`
- `createCompetency()`: `HttpStatus.CONFLICT` → `HttpStatus.BAD_REQUEST`.
- Test: `competency.controller.spec.ts` — POST duplicate name → 400.

### TFB-W2 [x] PATCH /subject-competencies/:uuid differentiated errors (was 422 blanket)
- File: `api/src/presentation/pedagogy/pedagogy.controller.ts`
- `updateCompetency()`: `instanceof NotFoundError` → 404; else → 400. Removed 422.
- Also import `NotFoundError` from `@educandow/domain`.
- Test: `competency.controller.spec.ts` — PATCH not-found → 404; PATCH duplicate → 400.

### TFB-W3 [x] CreateSubjectAssignmentUC AutoCreate fire-and-forget
- File: `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts`
- Wrap `autoCreateUC.executeForSubjectAssignment(...)` in `.catch(e => console.error(...))`.
  No `await` — failure MUST NOT propagate. SubjectAssignment creation succeeds regardless.

### TFB-W4 [x] Isolation test: AutoCreate throws → CreateSubjectAssignmentUC still returns ok
- File: `api/src/application/pedagogy/__tests__/subject-assignment.use-cases.test.ts` (new)
- Two scenarios: mock throws, mock returns rejected promise → both still resolve `isOk() === true`.

### TFB-GATE [x] Test + build gates
- `pnpm --filter api test`: 617/623 passed (6 pre-existing failures unchanged, 8 new tests all green).
- `pnpm --filter api build`: 0 TypeScript issues, 296 files compiled cleanly.

---

## Dependency Order

```
PR1 (domain+schema) → PR2 (infra+app) → PR3 (presentation) → PR4 (web)
                                    ↘ optional merge PR2+PR3 ↗
```

All PRs are sequential. No parallel application. PR2 imports PR1 types; PR3 imports PR2 UCs; PR4 calls PR3 routes.

---

## Task Summary

| PR | Tasks | RED tasks | GREEN tasks | GATE tasks |
|----|-------|-----------|-------------|------------|
| PR1 | 8 | 1 | 6 | 1 |
| PR2 | 7 | 1 | 5 | 1 |
| PR3 | 4 | 1 | 2 | 1 |
| PR4 | 5 | 1 | 3 | 1 |
| **Total** | **24** | **4** | **16** | **4** |
