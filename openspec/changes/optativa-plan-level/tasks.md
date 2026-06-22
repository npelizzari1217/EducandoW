# Tasks: optativa-plan-level

> Change: optativa-plan-level
> Store: hybrid (engram `sdd/optativa-plan-level/tasks`)
> Spec IDs: MGC-R13–MGC-R16 / MGC-S28–MGC-S38
> TDD mode: strict — test first, `pnpm test`, coverage ≥ 80%
> PR decomposition: PR1 (backend chain) → PR2 (presentation + web)

---

## Dependency graph

```
T01 (schema) → T02 (migration+generate)
                       ↓
T03 (domain types) ──→ [T04/T05] [T06/T07] [T08/T09] [T10/T11]
                                                    ↓ (all done)
                                                   T12 (integration)
                                                    ↓
                                                   T13 (PR1 verify)
                                                    ↓
                                               PR2: T14 → T15+T16+T17
                                                    ↓
                                                   T18 (PR2 verify)
```

T03 can start in parallel with T02 (pure TypeScript, no Prisma types needed).
T06/T07, T08/T09, T10/T11 are independent pairs — can run in parallel after T03.
T04/T05 require T02 (Prisma generated types).
T12 is sequential — requires T05, T09, and T11 all done.
PR2 is sequential after PR1 merges (UI consumes the API; flag defaults false so PR1 is safe alone).

---

## PR1 — Backend chain

**Files:** `api/prisma_tenant/schema.prisma`, `packages/domain/src/pedagogy/repositories/study-plan-repository.ts`, `api/src/infrastructure/persistence/prisma/repositories/prisma-study-plan.repository.ts`, `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts`, `api/src/application/materia-grupo-ciclo/materialize-materias.use-case.ts`, `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts`, plus their test files.

---

### T01 — Schema: add `esOptativa` to `StudyPlanSubject`

- [x] In `api/prisma_tenant/schema.prisma`, add to `StudyPlanSubject` model (near L596):
  ```prisma
  esOptativa Boolean @default(false) @map("es_optativa")
  ```
- No backfill. `@default(false)` makes every existing row obligatoria (D4).

**Req:** MGC-R13, MGC-S28 | **Design:** D4
**Sequential:** must be first.

---

### T02 — Migration + Prisma generate

- [x] Run `pnpm --filter api prisma:migrate:tenant` (dev sandbox DATABASE_URL = educandow_tenant_dev).
- [x] Run `pnpm --filter api prisma:generate` to update the TypeScript client.
- [x] Verify generated types include `StudyPlanSubject.esOptativa`.

**Req:** MGC-R13 | **Design:** D4
**Sequential after T01.**

---

### T03 — Domain: extend DTO + port method signature

- [x] In `packages/domain/src/pedagogy/repositories/study-plan-repository.ts`:
  - `StudyPlanCourseDto.subjects[]` (L10): add `esOptativa?: boolean` to the subject shape.
  - `addSubject` port method (L20): add `esOptativa?: boolean` as trailing optional param.
- Trailing + optional = backward compatible; all existing callers compile unchanged (D4).

**Req:** MGC-R13, MGC-R16 | **Design:** D1, D4
**Can start in parallel with T02.**

---

### T04 [RED] — Test: `PrismaStudyPlanRepository` round-trip

File: `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-study-plan.repository.test.ts`

- [x] **Test A (MGC-S29):** `addSubject(planCourseId, subjectId, 3, true)` → mock Prisma upsert called with `create: { ..., esOptativa: true }` AND `update: { esOptativa: true }`.
- [x] **Test B (MGC-S28):** `addSubject(planCourseId, subjectId)` (no flag) → Prisma upsert called with `create: { ..., esOptativa: undefined }` (not coerced to false, D5).
- [x] **Test C (D5 / MGC-S35):** `findPlanCourseById` and `findPlanCoursesByPlan` mock returns subject with `esOptativa: true` → DTO has `esOptativa: true`.
- [x] **Test D (D5 LOCK):** `addSubject(planCourseId, subjectId, 5)` (hoursPerWeek only, no esOptativa) → Prisma `update:{}` called with `esOptativa: undefined` (NOT `false`). Asserts that omitting the flag does not coerce to false.

All tests must be RED before moving to T05.

**Req:** MGC-S28, MGC-S29, MGC-S37, MGC-R15 | **Design:** D4, D5
**Sequential after T02 + T03.**

---

### T05 [GREEN] — Impl: `PrismaStudyPlanRepository`

File: `api/src/infrastructure/persistence/prisma/repositories/prisma-study-plan.repository.ts`

- [x] `addSubject(planCourseId, subjectId, hoursPerWeek?, esOptativa?)`:
  - `create:` block: include `esOptativa` (passes `undefined` when omitted — Prisma skips field).
  - `update:` block: include `esOptativa` (same — undefined = no-op per D5).
  - Add inline comment: `// esOptativa: undefined here is intentional — Prisma skips the field rather than setting false (D5: preserve per-CC PATCH overrides)`
- [x] `findPlanCourseById` (L98): map `esOptativa: s.esOptativa` for each subject.
- [x] `findPlanCoursesByPlan` (L121): map `esOptativa: s.esOptativa` for each subject.
- [x] Run T04 tests → all GREEN.

**Req:** MGC-S28, MGC-S29, MGC-S37, MGC-S38 | **Design:** D3, D4, D5
**Sequential after T04.**

---

### T06 [RED] — Test: `AddSubjectToPlanCourseUC` forwards `esOptativa`

File: `api/src/application/pedagogy/__tests__/study-plan.use-cases.test.ts`

- [x] **Test A (MGC-S29):** `execute(planCourseId, subjectId, hours, esOptativa: true)` → mocked `planRepo.addSubject` called with `(planCourseId, subjectId, hours, true)`.
- [x] **Test B (MGC-S37):** `execute(planCourseId, subjectId, hours, esOptativa: false)` → mocked `planRepo.addSubject` called with `false`.
- [x] **Test C (D5):** `execute(planCourseId, subjectId, hours)` (no esOptativa) → mocked `planRepo.addSubject` called with `undefined` as 4th arg (not `false`).

All tests must be RED before T07.

**Req:** MGC-R16, MGC-S29, MGC-S37 | **Design:** D3, D4, D5
**Can run in parallel with T04/T05, T08/T09, T10/T11 — after T03.**

---

### T07 [GREEN] — Impl: `AddSubjectToPlanCourseUC`

File: `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` (L348)

- [x] Add `esOptativa?: boolean` as trailing param to `execute(...)`.
- [x] Forward to `this.planRepo.addSubject(planCourseId, subjectId, hoursPerWeek, esOptativa)`.
- [x] Run T06 tests → all GREEN.

**Req:** MGC-R16, MGC-S29 | **Design:** D3, D4
**Sequential after T06.**

---

### T08 [RED] — Test: `MaterializeMateriasUseCase` inherits + D2 LOCK

File: `api/src/application/materia-grupo-ciclo/__tests__/materialize-materias.use-case.test.ts`

- [x] **Test A (MGC-S30 / MGC-R14):** `planSubjects` includes `{ subjectId, studyPlanSubjectId, esOptativa: true }` → mocked `materiaRepo.upsertMany` called with `esOptativa: true` for that entry.
- [x] **Test B (MGC-S31):** `planSubjects` with `esOptativa: false` → `upsertMany` called with `esOptativa: false`.
- [x] **Test C (MGC-S32):** mixed plan — `[{ esOptativa: false }, { esOptativa: true }, { esOptativa: false }]` → each `upsertMany` call argument has the correct per-subject value.
- [x] **Test D (D2 LOCK / MGC-R15):** verify that Step-2 `updateDescription` spy is NOT called with any argument containing `esOptativa`. This guards the additive re-gen rule. (Inspect the mock call args for the update/re-sync path and assert `esOptativa` is absent.)

All tests must be RED before T09.

**Req:** MGC-R14, MGC-R15, MGC-S30, MGC-S31, MGC-S32, MGC-S34 | **Design:** D2, D4
**Can run in parallel with T04/T05, T06/T07, T10/T11 — after T03.**

---

### T09 [GREEN] — Impl: `MaterializeMateriasUseCase`

File: `api/src/application/materia-grupo-ciclo/materialize-materias.use-case.ts`

- [x] `PlanSubjectInput` interface (L4): add `esOptativa?: boolean`.
- [x] Step-1 `upsertMany` create map (L34–39): include `esOptativa: input.esOptativa` in each entry.
- [x] Step-2 `updateDescription` re-sync (L41–63): must NOT include `esOptativa`. Add explicit comment:
  ```ts
  // D2 LOCK: do NOT add esOptativa here.
  // Step-2 only re-syncs studyPlanSubjectId. Adding esOptativa would overwrite
  // per-CC PATCH overrides (MGC-R10) on re-generation. Additive semantics (MGC-R15)
  // are enforced by upsertMany skipDuplicates in Step-1.
  ```
- [x] Run T08 tests → all GREEN.

**Req:** MGC-R14, MGC-R15 | **Design:** D2, D4
**Sequential after T08.**

---

### T10 [RED] — Test: `GenerateCourseCyclesUseCase` maps `esOptativa`

File: `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts`

- [x] **Test A (MGC-S30/S31):** mocked `planRepo.findPlanCoursesByPlan` returns subjects with mixed `esOptativa` values → the `planSubjects` list forwarded to mocked `materializeUC.execute` has each subject's `esOptativa` correctly set.
- [x] **Test B (MGC-S32):** 3-subject plan with `[false, true, false]` → `planSubjects` forwarded in same order with same values.
- [x] **Test C (MGC-S33 / backward compat):** subject with no `esOptativa` field on plan (undefined) → forwarded as `undefined` (not coerced to false, D4/D5).

All tests must be RED before T11.

**Req:** MGC-R14, MGC-S30, MGC-S31, MGC-S32, MGC-S33 | **Design:** D1, D4
**Can run in parallel with T04/T05, T06/T07, T08/T09 — after T03.**

---

### T11 [GREEN] — Impl: `GenerateCourseCyclesUseCase`

File: `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` (L404)

- [x] In the `planSubjects` mapping loop, add `esOptativa: s.esOptativa` to each entry (where `s` is the source `StudyPlanCourseDto.subjects[]` element).
- [x] Run T10 tests → all GREEN.

**Req:** MGC-R14, MGC-S30 | **Design:** D1
**Sequential after T10.**

---

### T12 [RED + GREEN] — Integration test: full round-trip + re-gen LOCK

File: `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-study-plan.repository.test.ts` (new describe block, mocked Prisma client matching existing pattern)

- [x] **Test E (MGC-S29 + MGC-S38):** `addSubject(..., true)` then `findPlanCourseById` → returned subject DTO has `esOptativa: true`. `findPlanCoursesByPlan` also returns `esOptativa: true` for same subject.
- [x] **Test F (D5 / MGC-S35):** `addSubject(..., hours: 4, esOptativa: true)` then `addSubject(..., hours: 5)` (omit flag) → assert mocked Prisma `update:{}` on the second call contains `esOptativa: undefined` (not `false`), so existing value is preserved.
- [x] **Test G (MGC-S36):** assert that `addSubject` on a NEW subject creates a row with `esOptativa: true` when flag is supplied.

Write tests RED, implement if anything is missing in T05/T07/T09/T11, run GREEN.

**Req:** MGC-S29, MGC-S35, MGC-S36, MGC-S38 | **Design:** D2, D5
**Sequential after T05, T09, T11.**

---

### T13 [VERIFY] — PR1 test run

- [x] `pnpm --filter api test` → all tests pass, coverage ≥ 80%.
- [x] `pnpm --filter api typecheck` → no TypeScript errors.
- [ ] Open PR1 for review.

**Sequential after T12.**

---

## PR2 — Presentation + Web

**Files:** `api/src/presentation/auth/dto/register.request.ts`, `api/src/presentation/pedagogy/pedagogy.controller.ts`, `web/src/pages/dashboard/study-plans.tsx`, and their test files.
**Sequential after PR1 merges.**

---

### T14 [RED] — Test: controller handles `esOptativa`

File: `api/src/presentation/pedagogy/__tests__/study-plan.controller.test.ts`

- [ ] **Test A (MGC-S29 / MGC-R16):** `POST /study-plan-courses/:id/subjects` with body `{ subjectId, esOptativa: true }` → Zod schema parses successfully → mocked `addSubjectUC.execute` called with `esOptativa: true`.
- [ ] **Test B (MGC-S28 / D4):** body without `esOptativa` → Zod parses (optional field), UC called with `esOptativa: undefined`.
- [ ] **Test C (MGC-S38):** `GET /study-plan-courses/:id/subjects` (`listPlanCourseSubjects`) response body for each subject includes `esOptativa` field.
- [ ] **Test D (MGC-S38):** `getPlan` subjects map in response includes `esOptativa` per subject entry.

All tests must be RED before T15/T16.

**Req:** MGC-R16, MGC-S29, MGC-S37, MGC-S38 | **Design:** D3
**Sequential after PR1 merges; can start writing tests immediately.**

---

### T15 [GREEN] — Zod schema: `AddSubjectToPlanCourseSchema`

File: `api/src/presentation/auth/dto/register.request.ts` (L133)

- [ ] Add `esOptativa: z.boolean().optional()` to `AddSubjectToPlanCourseSchema`.
- [ ] `AddSubjectToPlanCourseDTO` type is inferred automatically via `z.infer<>`.

**Req:** MGC-R16, MGC-S29 | **Design:** D3, D4
**Sequential after T14; can run in parallel with T16 (different line).**

---

### T16 [GREEN] — Controller: 3 handler updates

File: `api/src/presentation/pedagogy/pedagogy.controller.ts`

- [ ] `addSubjectToPlanCourse` handler (L259): pass `b.esOptativa` to `addSubjectUC.execute(...)`.
- [ ] `getPlan` subjects map (L192): add `esOptativa: s.esOptativa` to the response shape for each subject entry.
- [ ] `listPlanCourseSubjects` (L250): add `esOptativa: s.esOptativa ?? false` to each subject in the response array.
- [ ] Run T14 tests → all GREEN.

**Req:** MGC-R16, MGC-S37, MGC-S38 | **Design:** D3
**Sequential after T14 + T15.**

---

### T17 [GREEN] — Web: interface + standalone toggle/badge + api-client

File: `web/src/pages/dashboard/study-plans.tsx`

- [ ] `PlanCourseSubject` interface (L46): add `esOptativa?: boolean`.
- [ ] Subject row (L940–973): add **standalone** optativa toggle/badge — NOT inside the inline name-edit state (D6). When `esOptativa` is true, show an "Optativa" badge next to the subject name. When false, badge is absent or shows "Obligatoria".
- [ ] Near the toggle control, show hint text: `"aplica en la próxima generación de CC"` (communicates that existing CCs are not retroactively updated — MGC-R15).
- [ ] api-client POST body at L391 (`/study-plan-courses/${planCourseId}/subjects`): include `esOptativa` from the toggle state in the request body. The existing `hoursPerWeek: 4` hardcode stays (additive change, D4).

**Req:** MGC-R16, MGC-S38 | **Design:** D6
**Can run in parallel with T15/T16 — independent file.**

---

### T18 [VERIFY] — PR2 test run

- [ ] `pnpm --filter api test` → all tests pass, coverage ≥ 80%.
- [ ] `pnpm --filter api typecheck` → no TypeScript errors.
- [ ] `pnpm --filter web typecheck` → no TypeScript errors.
- [ ] Open PR2 for review.

**Sequential after T16 + T17.**

---

## Summary

| PR | Tasks | Type breakdown | Key constraint |
|----|-------|----------------|----------------|
| PR1 | T01–T13 (13) | 3 impl-first (schema/migration/domain) + 8 RED/GREEN pairs + 2 verify | T12 is the chain-integrity gate |
| PR2 | T14–T18 (5) | 1 RED + 3 GREEN + 1 verify | T14 RED before any GREEN |
| **Total** | **18** | | |

### Parallel opportunities

| Group | Tasks | Condition |
|-------|-------|-----------|
| Schema + Domain types | T02 ∥ T03 | After T01 |
| Infra + UC units | T04/T05 ∥ T06/T07 ∥ T08/T09 ∥ T10/T11 | After T02+T03 (T04 needs T02; others need T03) |
| Zod + Controller + Web | T15 ∥ T16 ∥ T17 | After T14 RED |

### Critical design calls embedded in tasks

| Decision | Task that tests it | Task that implements it |
|----------|-------------------|------------------------|
| D2 LOCK (re-gen NOT update esOptativa) | T08 Test D | T09 (comment + no esOptativa in Step-2) |
| D5 (undefined ≠ false in Prisma update) | T04 Test D, T12 Test F | T05 (no coercion) |
| D6 (toggle standalone, not in name-edit) | — (UI assertion) | T17 (placement in row) |
| D4 (optional trailing, backward compat) | T06 Test C, T10 Test C | T03, T07, T09, T11 |

---

## Review Workload Forecast

| PR | Est. production lines | Est. test lines | Total |
|----|----------------------|-----------------|-------|
| PR1 | ~40 (6 files, 1–4 lines each) | ~80 (4 unit test blocks + 3 integration assertions) | ~120 |
| PR2 | ~25 (Zod +1, controller +3, web +15–20) | ~40 (4 controller test cases) | ~65 |
| **Combined** | **~65** | **~120** | **~185** |

**400-line budget risk:** Low (both PRs combined well under threshold).
**Chained PRs recommended:** No — two slices but either can ship independently. PR1 first is preferred (UI consumes API); PR1 is safe alone since flag defaults to `false`.
**Decision needed before apply:** No.
**Delivery strategy:** `ask-on-risk` default is satisfied — no risk trigger fires.
