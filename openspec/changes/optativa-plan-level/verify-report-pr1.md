# Verify Report: optativa-plan-level — PR1

> Phase: verify · Branch: feat/optativa-plan-level-pr1
> Date: 2026-06-22
> Scope: PR1 backend chain (T01–T13). PR2 (presentation/web) intentionally out of scope.
> Verdict: **PASS** — 0 CRITICAL · 0 WARNING · 1 SUGGESTION · 1 INFORMATIONAL

---

## 1. Test Suite

```
pnpm --filter api test
Test Files: 160 passed (160)
Tests:      1535 passed (1535)
Duration:   36.76s
```

All 1535 tests pass. 18 new tests confirmed present (+13 in prisma-study-plan.repository.test.ts, +3 in study-plan.use-cases.test.ts, +4 in materialize-materias.use-case.test.ts, +3 in course-cycle.use-cases.test.ts). No regressions.

## 2. Typecheck

```
pnpm --filter @educandow/domain build  → exit 0
pnpm --filter api typecheck            → exit 0
```

No TypeScript errors.

## 3. Migration Cleanliness

File: `api/prisma_tenant/migrations/20260622145831_add_es_optativa_to_study_plan_subject/migration.sql`

```sql
-- Migration: add esOptativa flag to study_plan_subjects (optativa-plan-level).
-- Plan-level optativa designation; flows into MateriaXCursoXCiclo at materialization.
-- No backfill — existing rows default to false (obligatoria).
ALTER TABLE "study_plan_subjects" ADD COLUMN "es_optativa" BOOLEAN NOT NULL DEFAULT false;
```

**PASS.** File contains exactly one ALTER TABLE statement. The previously noted ~50 lines of unrelated drift (FK/index renames, timestamp changes) have been stripped. Migration is clean and scoped to this change.

## 4. Chain Integrity

Every hop of the esOptativa flag verified by reading source code:

| Hop | File | Line(s) | Status |
|-----|------|---------|--------|
| Schema — StudyPlanSubject.esOptativa | `api/prisma_tenant/schema.prisma` | L601 | PASS |
| Domain DTO — subjects[].esOptativa? | `packages/domain/src/pedagogy/repositories/study-plan-repository.ts` | L10 | PASS |
| Domain port — addSubject(..., esOptativa?) | same file | L20 | PASS |
| PrismaStudyPlanRepository.addSubject — create:{esOptativa} + update:{esOptativa} | `api/src/infrastructure/persistence/prisma/repositories/prisma-study-plan.repository.ts` | L69–75 | PASS |
| findPlanCourseById — maps esOptativa out | same file | L104 | PASS |
| findPlanCoursesByPlan — maps esOptativa out | same file | L128 | PASS |
| AddSubjectToPlanCourseUC.execute — esOptativa? param + forward | `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | L350, L355 | PASS |
| PlanSubjectInput.esOptativa? | `api/src/application/materia-grupo-ciclo/materialize-materias.use-case.ts` | L7 | PASS |
| Step-1 upsertMany — esOptativa: s.esOptativa | same file | L39 | PASS |
| Step-2 updateDescription — NO esOptativa (D2 LOCK) | same file | L64–68 | PASS |
| GenerateCourseCyclesUseCase — esOptativa: s.esOptativa in map | `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` | L407 | PASS |
| MateriaXCursoXCicloRepository.upsertMany — already accepts esOptativa | (existing — no change) | — | PASS |

No dropped hop. Chain is intact end-to-end.

## 5. Test Body Verification

### D2 — Re-gen additive: updateDescription MUST NOT contain esOptativa

**File:** `api/src/application/materia-grupo-ciclo/__tests__/materialize-materias.use-case.test.ts` — Test D

Setup: existing materia with `studyPlanSubjectId: 'old-sps-1'`. Execute with `{ subjectId: 'subj-1', studyPlanSubjectId: 'new-sps-1', esOptativa: true }`.

Assert: all `updateDescription` call args have `not.toHaveProperty('esOptativa')`.

**PASS.** Test properly exercises re-gen path AND asserts esOptativa is absent from Step-2 call args. Implementation has the `// D2 LOCK` comment blocking future drift.

### D5 — undefined ≠ false in Prisma update

**File:** `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-study-plan.repository.test.ts` — Tests B and D

- Test B: `addSubject('pc-1', 'subj-1')` (no args) → `arg.create.esOptativa` is `toBeUndefined()`.
- Test D: `addSubject('pc-1', 'subj-1', 5)` (hours only) → `arg.update.esOptativa` is `toBeUndefined()` AND `not.toBe(false)`.

**PASS.** Both create and update paths assert `undefined`, not `false`. Implementation passes `esOptativa` directly without coercion — Prisma treats `undefined` as "skip field".

### Materialize inherits esOptativa from plan subject

**File:** `api/src/application/materia-grupo-ciclo/__tests__/materialize-materias.use-case.test.ts` — Tests A, B, C

- Test A: esOptativa: true in planSubjects → upsertMany called with esOptativa: true.
- Test B: esOptativa: false → upsertMany called with esOptativa: false.
- Test C: 3-subject mixed plan → each subject gets its own value per-index.

**PASS.** All inheritance scenarios covered.

### GenerateCourseCycles maps esOptativa

**File:** `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts` — Tests A, B, C

- Test A: mixed values [false, true] → forwarded correctly to materializeUC planSubjects.
- Test B: 3-subject [false, true, false] → per-index values preserved in order.
- Test C: subject with no esOptativa field → forwarded as `undefined` (not coerced to false, D4).

**PASS.** Forward-mapping and backward-compat case covered.

## 6. Task Completion

| Task | Spec item | Status |
|------|-----------|--------|
| T01 — Schema | MGC-R13, MGC-S28 | [x] |
| T02 — Migration + generate | MGC-R13 | [x] |
| T03 — Domain DTO + port | MGC-R13, MGC-R16 | [x] |
| T04 — Repo tests RED | MGC-S28/29/35/37 | [x] |
| T05 — Repo impl GREEN | MGC-S28/29/37/38 | [x] |
| T06 — AddSubjectUC tests RED | MGC-R16, MGC-S29/37 | [x] |
| T07 — AddSubjectUC impl GREEN | MGC-R16, MGC-S29 | [x] |
| T08 — MaterializeUC tests RED | MGC-R14/15, MGC-S30/31/32/34 | [x] |
| T09 — MaterializeUC impl GREEN | MGC-R14/15 | [x] |
| T10 — GenerateCyclesUC tests RED | MGC-R14, MGC-S30/31/32/33 | [x] |
| T11 — GenerateCyclesUC impl GREEN | MGC-R14, MGC-S30 | [x] |
| T12 — Integration round-trip | MGC-S29/35/36/38 | [x] |
| T13 — PR1 test + typecheck | — | [x] (test + typecheck ✓; PR open = human step) |

All implementation tasks [x]. "Open PR1 for review" in T13 is a human action step, not a code task.

## 7. Findings

### SUGGESTION — Test B missing update path assertion

**File:** `prisma-study-plan.repository.test.ts`, Test B (L123–135)

Test B asserts `create.esOptativa` is undefined for a fully-omitted call but does not explicitly check `update.esOptativa`. Test D covers the `update` path for the hours-only case, so D5 is correctly guarded. This is a very minor redundancy gap — adding the update assertion to Test B would make the coverage more explicit per the spec wording. Not blocking.

### INFORMATIONAL — Pre-existing schema-vs-migration-history drift

During `prisma migrate dev`, the initial run bundled ~50 lines of unrelated pending drift (FK renames, index renames, timestamp(3) changes) alongside the `es_optativa` column. This drift was stripped; the final migration file is clean.

**This is a pre-existing project-level issue** (the dev migration baseline had accumulated uncommitted drift) and is NOT introduced by this PR. It does not affect correctness or production deployability of the `es_optativa` column addition. The clean migration file confirms PR1 is correctly scoped.

---

## Summary

| Category | Count |
|----------|-------|
| CRITICAL | 0 |
| WARNING  | 0 |
| SUGGESTION | 1 (Test B missing update assertion — non-blocking) |
| INFORMATIONAL | 1 (pre-existing drift — not introduced by PR1) |

**Overall verdict: PASS**

- Test suite: 1535/1535 passing
- Typecheck: exit 0
- Migration: clean (1 ALTER TABLE)
- Chain: all 12 hops intact, no dropped hop
- D2 LOCK: verified in impl + test
- D5 (undefined ≠ false): verified in impl + 2 test assertions
- Safe to commit: **YES**
- Next recommended: `sdd-archive`
