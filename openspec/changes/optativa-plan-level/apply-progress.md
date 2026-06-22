# Apply Progress: optativa-plan-level — PR1 + PR2

> Batch: 2 of 2 (PR2 presentation + web — T14–T18)
> Status: DONE
> Date: 2026-06-22
> Branch: feat/optativa-plan-level-pr2

## Summary

All tasks (T01–T18) implemented and verified across both PRs.

**PR1** (T01–T13): 18 new tests, full test suite 1535 passed / 160 files, typecheck exit 0.
**PR2** (T14–T18): +4 API controller tests + 6 web tests (TDD RED→GREEN). Total: 1539 API / 441 web. Both typechecks exit 0.

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
| T14 [RED] — Controller tests: esOptativa | [x] DONE | 4 new tests; all confirmed RED before T15/T16 |
| T15 [GREEN] — Zod schema: AddSubjectToPlanCourseSchema | [x] DONE | `register.request.ts` |
| T16 [GREEN] — Controller: 3 handler updates | [x] DONE | `pedagogy.controller.ts` |
| T17 [GREEN] — Web: interface + toggle/badge + api-client | [x] DONE | `study-plans.tsx` + 6 web tests |
| T18 [VERIFY] — PR2 test run | [x] DONE | 1539 API / 441 web; both typechecks exit 0 |

## Key design decisions implemented

- **D2 LOCK** (additive re-gen): Step-2 `updateDescription` in `MaterializeMateriasUseCase` does NOT include `esOptativa`. Explicit comment added.
- **D5** (undefined ≠ false): Prisma `update:{}` receives `undefined` when caller omits the flag — Prisma skips the field, preserving existing DB value. Tests B and D explicitly assert `undefined` (not `false`).
- **D4** (optional trailing param): All signatures are backward compatible (`esOptativa?` trailing).
- **Migration**: Applied to `educandow_tenant_dev` sandbox (safe, separate from master).

## Files changed (PR1 — already merged)

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

## Files changed (PR2)

| File | Change |
|------|--------|
| `api/src/presentation/auth/dto/register.request.ts` | +`esOptativa: z.boolean().optional()` to `AddSubjectToPlanCourseSchema` |
| `api/src/presentation/pedagogy/pedagogy.controller.ts` | `addSubjectToPlanCourse` passes `b.esOptativa`; `getPlan` and `listPlanCourseSubjects` map `esOptativa` in response |
| `api/src/presentation/pedagogy/__tests__/study-plan.controller.test.ts` | +4 tests (T14 RED→GREEN): Tests A/B (addSubject), C (listPlanCourseSubjects), D (getPlan) |
| `web/src/pages/dashboard/study-plans.tsx` | `PlanCourseSubject.esOptativa?`; `handleToggleOptativa`; badge + toggle button + hint in subject row; `handleCreateSubjectInline` sends `esOptativa: false` |
| `web/src/pages/dashboard/__tests__/study-plans-optativa.test.tsx` | +6 web tests: badge visible (T, F), hint text, toggle POST with esOptativa:true/false, refresh after toggle |
| `openspec/changes/optativa-plan-level/tasks.md` | T14–T18 marked [x] |
| `openspec/changes/optativa-plan-level/apply-progress.md` | PR2 progress merged |

## Test results

- Baseline: 1517 API tests / 160 files; 436 web tests / 43 files
- After PR1: 1535 API tests (+18), typecheck exit 0
- After PR2: 1539 API tests (+4), 441 web tests (+6 new T17 tests), both typechecks exit 0
- All passing: YES

## Next

- Open PR2 for review (orchestrator).
- sdd-verify can now run against the full T14–T18 scope.
