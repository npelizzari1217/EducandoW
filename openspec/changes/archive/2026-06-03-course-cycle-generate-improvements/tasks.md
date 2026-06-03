# Tasks: Course Cycle Generate Improvements

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~330 (223 additions + ~110 deletions) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | ask-on-risk |
| Suggested split | Single PR |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Domain — Update CreateManyResult type

- [x] 1.1 Add `updated: number` field to `CreateManyResult` in `packages/domain/src/course-cycle/repositories/course-cycle-repository.ts`

## Phase 2: Backend — Rewrite GenerateCourseCyclesUseCase

- [x] 2.1 Rewrite `GenerateCourseCyclesUseCase.execute()` in `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts`: replace `createMany`+skip with per-course UPSERT (`findByPair` → update `courseName` | create), derive `level` via `Level.fromParts(plan.level, plan.modality)`, iterate all plans when `studyPlanId` absent, return `{ created, updated, total }`
  - Depends on: 1.1

## Phase 3: Backend — Update DTO + Controller

- [x] 3.1 Add `level` field and make `studyPlanId` optional in `GenerateCourseCyclesDto` schema (`api/src/presentation/course-cycle/dto/course-cycle.dto.ts`)
- [x] 3.2 Map `level`, `studyPlanId?`, `cycleId` from DTO to use case input in generate handler (`api/src/presentation/course-cycle/course-cycle.controller.ts`)
  - Depends on: 2.1, 3.1

## Phase 4: Frontend — Remove modal, wire button to filters, add toast

- [x] 4.1 Update `GenerateResult` type in `web/src/types/course-cycle.ts`: rename `skipped` → `updated`
- [x] 4.2 Delete `web/src/components/course-cycle/GenerateCourseCyclesModal.tsx`
- [x] 4.3 In `web/src/pages/dashboard/course-cycles.tsx`: remove modal import, `showGenerateModal` state, `handleGenerated` callback and "Nuevo Curso por Ciclo" button; rewrite `handleGenerate` to send `{ level, cycleId, studyPlanId? }` from current filters; add optional `studyPlanId` (Plan de Estudio) filter combobox; show toast with `{ created, updated, total }` on success; "Generar Cursos" button disabled when `level` or `cycleId` filter unset
  - Depends on: 3.2, 4.1, 4.2

## Phase 5: Tests

- [x] 5.1 Backend use case tests (`api/src/application/course-cycle/use-cases/`): all new (5 created, 0 updated), partial update (3 created, 2 updated), level derivation via `Level.fromParts`, multi-plan with absent `studyPlanId`, no plans returns zeros, StudyPlan 404, AcademicCycle 404, inactive cycle 409
  - Depends on: 2.1, 3.2
- [x] 5.2 Frontend tests: button disabled without level+cycleId, submit with mandatory filters only, submit with optional studyPlanId, success toast displays result counts
  - Depends on: 4.3
