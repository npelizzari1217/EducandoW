# Apply Progress: optativa-plan-level — PR1

> Batch: 1 of 1 (PR1 backend chain — T01–T13)
> Status: DONE
> Date: 2026-06-22
> Branch: feat/optativa-plan-level-pr1

## Summary

All PR1 tasks (T01–T13) implemented and verified. 18 new tests added (5 RED → GREEN cycles). Full test suite: 1535 passed / 160 files. Typecheck: exit 0.

## Tasks completed

| Task | Status | Notes |
|------|--------|-------|
| T01 — Schema: add `esOptativa` to `StudyPlanSubject` | [x] DONE | `api/prisma_tenant/schema.prisma` |
| T02 — Migration + Prisma generate | [x] DONE | `20260622145831_add_es_optativa_to_study_plan_subject` applied to `educandow_tenant_dev`; domain pkg rebuilt |
| T03 — Domain: extend DTO + port method signature | [x] DONE | `packages/domain/src/pedagogy/repositories/study-plan-repository.ts` |
| T04 [RED] — PrismaStudyPlanRepository tests | [x] DONE | 8 new tests in `prisma-study-plan.repository.test.ts`; 5 confirmed RED |
| T05 [GREEN] — PrismaStudyPlanRepository impl | [x] DONE | `addSubject` + `find*` mapping |
| T06 [RED] — AddSubjectToPlanCourseUC tests | [x] DONE | 3 new tests; confirmed RED |
| T07 [GREEN] — AddSubjectToPlanCourseUC impl | [x] DONE | `pedagogy.use-cases.ts` |
| T08 [RED] — MaterializeMateriasUseCase tests | [x] DONE | 4 new tests; 3 confirmed RED (D2 LOCK test passed already) |
| T09 [GREEN] — MaterializeMateriasUseCase impl | [x] DONE | `PlanSubjectInput.esOptativa` + Step-1 map + D2 LOCK comment |
| T10 [RED] — GenerateCourseCyclesUseCase tests | [x] DONE | 3 new tests; 2 confirmed RED (undefined compat passed already) |
| T11 [GREEN] — GenerateCourseCyclesUseCase impl | [x] DONE | `esOptativa: s.esOptativa` in planSubjects map |
| T12 [INT] — Integration round-trip + D5 LOCK | [x] DONE | Covered by T04 Tests E, F, G (all GREEN in T05) |
| T13 [VERIFY] — PR1 test run | [x] DONE | 1535 passed / 0 failed; typecheck exit 0 |

## Key design decisions implemented

- **D2 LOCK** (additive re-gen): Step-2 `updateDescription` in `MaterializeMateriasUseCase` does NOT include `esOptativa`. Explicit comment added.
- **D5** (undefined ≠ false): Prisma `update:{}` receives `undefined` when caller omits the flag — Prisma skips the field, preserving existing DB value. Tests B and D explicitly assert `undefined` (not `false`).
- **D4** (optional trailing param): All signatures are backward compatible (`esOptativa?` trailing).
- **Migration**: Applied to `educandow_tenant_dev` sandbox (safe, separate from master).

## Files changed (PR1)

| File | Change |
|------|--------|
| `api/prisma_tenant/schema.prisma` | +1 line: `esOptativa Boolean @default(false) @map("es_optativa")` |
| `api/prisma_tenant/migrations/20260622145831_add_es_optativa_to_study_plan_subject/migration.sql` | New migration file (auto-generated) |
| `packages/domain/src/pedagogy/repositories/study-plan-repository.ts` | +`esOptativa?` in DTO subjects + `addSubject` port |
| `packages/domain/dist/*` | Rebuilt |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-study-plan.repository.ts` | `addSubject` + `find*` mapping |
| `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | `AddSubjectToPlanCourseUC.execute` param + forward |
| `api/src/application/materia-grupo-ciclo/materialize-materias.use-case.ts` | `PlanSubjectInput.esOptativa` + Step-1 map + D2 comment |
| `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` | `esOptativa: s.esOptativa` in planSubjects loop |
| `api/src/infrastructure/persistence/prisma/repositories/__tests__/prisma-study-plan.repository.test.ts` | +13 tests (T04 + T12) |
| `api/src/application/pedagogy/__tests__/study-plan.use-cases.test.ts` | +3 tests (T06) |
| `api/src/application/materia-grupo-ciclo/__tests__/materialize-materias.use-case.test.ts` | +4 tests (T08) |
| `api/src/application/course-cycle/__tests__/course-cycle.use-cases.test.ts` | +3 tests (T10) |
| `openspec/changes/optativa-plan-level/tasks.md` | T01–T13 marked [x] |

## Test results

- Baseline: 1517 tests / 160 files
- After PR1: 1535 tests / 160 files (+18 new tests)
- All passing: YES
- Typecheck (`pnpm --filter api typecheck`): exit 0

## Next

- PR2 (T14–T18): presentation + web layer. Scope: `api/src/presentation/pedagogy/`, `web/src/pages/dashboard/study-plans.tsx`.
- Open PR1 for review (orchestrator).
