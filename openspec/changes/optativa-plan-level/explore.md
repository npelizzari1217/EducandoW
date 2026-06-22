# Exploration: optativa-plan-level

> Change: optativa-plan-level — Follow-up of optativas-inscripcion (approach C / full)
> Phase: explore · Store: hybrid (engram `sdd/optativa-plan-level/explore`)

## Problem Framing

`optativas-inscripcion` shipped `MateriaXCursoXCiclo.esOptativa` + cascade filter + per-CC toggle (PATCH). Admins must now mark each materia optativa per-CourseCycle **after** materialization, which is repetitive for institutions with many CCs. This change adds `StudyPlanSubject.esOptativa` so the designation flows from the plan into materialization automatically — every new CC generated from a plan inherits the flag. The per-CC PATCH remains as a post-gen override. This is the explicitly deferred "approach C" from the optativas-inscripcion explore.

## Current Model (file:line refs)

### Schema (`api/prisma_tenant/schema.prisma`)
- `MateriaXCursoXCiclo` (line 178): `esOptativa Boolean @default(false) @map("es_optativa")` — **SHIPPED**
- `StudyPlanSubject` (lines 596–610): `id, studyPlanCourseId, subjectId, hoursPerWeek?` — **NO esOptativa**

### Domain port (`packages/domain/src/pedagogy/repositories/study-plan-repository.ts`)
- `StudyPlanCourseDto.subjects` (line 10): `{ id: string; subjectId: string; subjectName?: string; hoursPerWeek?: number }[]` — **NO esOptativa**
- `addSubject(planCourseId, subjectId, hoursPerWeek?)` (line 20) — **NO esOptativa**
- `MateriaXCursoXCicloRepository.upsertMany` (`packages/domain/src/materia-grupo-ciclo/repositories/materia-x-curso-x-ciclo-repository.ts` line 15): **already accepts `esOptativa?: boolean`** — callers just don't pass it yet

### Application layer
- `AddSubjectToPlanCourseUC` (`api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` line 348): no esOptativa
- `MaterializeMateriasUseCase.PlanSubjectInput` (`api/src/application/materia-grupo-ciclo/materialize-materias.use-case.ts` line 4): `{ subjectId, studyPlanSubjectId? }` — **NO esOptativa**
- `GenerateCourseCyclesUseCase` (`api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` lines 400–412): maps `pc.subjects!.map(s => ({ subjectId: s.subjectId, studyPlanSubjectId: s.id }))` — does NOT pass esOptativa
- `CascadeStudentMateriasCompetenciasUseCase` (line 56): **already filters `!m.esOptativa`** — **SHIPPED**

### Infrastructure (`api/src/infrastructure/persistence/prisma/repositories/prisma-study-plan.repository.ts`)
- `addSubject` (line 69): upserts without esOptativa
- `findPlanCourseById` / `findPlanCoursesByPlan` (lines 84–128): maps subjects without esOptativa

### Presentation
- `AddSubjectToPlanCourseSchema` (`api/src/presentation/auth/dto/register.request.ts` line 133): `{ subjectId, hoursPerWeek? }` — **NO esOptativa**
- `pedagogy.controller.ts listPlanCourseSubjects` (line 247): response omits esOptativa
- `pedagogy.controller.ts getPlan` subjects mapping (line 186): omits esOptativa
- `pedagogy.controller.ts addSubjectToPlanCourse` (line 259): calls UC without esOptativa

### Web UI (`web/src/pages/dashboard/study-plans.tsx`)
- `PlanCourseSubject` interface (line 46): `{ id, subjectId, subjectName, hoursPerWeek }` — **NO esOptativa**
- Subject render (lines 940–973): no optativa badge, no toggle

## Key Questions Answered

1. **Does `upsertMany` already accept esOptativa?** YES (port + Prisma impl, shipped). Gap is upstream — `GenerateCourseCycles` → `MaterializeMateriasUseCase` don't propagate it from the plan.

2. **Exact chain for the flag:**
   ```
   StudyPlanSubject.esOptativa (schema)
     → StudyPlanCourseDto.subjects[].esOptativa (domain DTO)
     → PrismaStudyPlanRepository.addSubject / findPlanCourseById / findPlanCoursesByPlan
     → AddSubjectToPlanCourseUC
     → GenerateCourseCyclesUseCase (pc.subjects[].esOptativa)
     → MaterializeMateriasUseCase.PlanSubjectInput.esOptativa
     → upsertMany({ ..., esOptativa })
     → MateriaXCursoXCiclo.esOptativa  ← already exists
   ```
   Each step is 1–4 lines. No structural change needed anywhere.

3. **Re-gen propagation to existing CCs?** `MaterializeMateriasUseCase` re-syncs `studyPlanSubjectId` only; does NOT touch `esOptativa` on existing rows. Under additive semantics, plan flag flows into NEW materializations only. Per-CC PATCH for post-gen correction.

4. **Interaction with per-CC PATCH toggle?** Clean/additive. Plan = default at materialization; PATCH = override afterward. No conflict.

5. **Backfill of existing `StudyPlanSubject`?** None — `@default(false)` = correct (all current subjects obligatorias).

6. **Backfill of existing `MateriaXCursoXCiclo`?** None — already `false` from optativas-inscripcion.

7. **Endpoint to update a plan subject's esOptativa after creation?** No new endpoint — `POST /study-plan-courses/:id/subjects` uses upsert (on-conflict-update); extend the Prisma `update:` clause to also set `esOptativa`.

## Approaches Compared

| | A: per-CC only (shipped) | B: plan-level, no re-gen propagation (C-minimal) | C: plan-level + re-gen propagation (C-full) |
|---|---|---|---|
| Schema migrations | 0 | 1 (StudyPlanSubject) | 1 |
| Application changes | 0 | minimal pass-through | + re-sync step in materialize |
| Re-gen behavior | per-CC PATCH only | NEW CCs inherit; existing unchanged | plan change overwrites existing on re-gen |
| Risk | admin repetition | low — non-destructive | may silently undo manual per-CC overrides |
| Est. changed lines | 0 | ~60–80 | ~90–110 |

**Recommendation: B (C-minimal)** — plan flag flows into new materializations only; re-gen stays additive-only. Per-CC PATCH remains the override.

## Scope In / Out

### In scope
- Schema: `StudyPlanSubject.esOptativa Boolean @default(false) @map("es_optativa")`
- Domain: `StudyPlanCourseDto.subjects[]` + `StudyPlanRepository.addSubject` include `esOptativa?: boolean`
- Infra: `PrismaStudyPlanRepository.addSubject`, `findPlanCourseById`, `findPlanCoursesByPlan` include `esOptativa`
- App: `AddSubjectToPlanCourseUC`, `PlanSubjectInput` (materialize), `GenerateCourseCyclesUseCase` pass `esOptativa` through
- Presentation: `AddSubjectToPlanCourseSchema` + three controller handlers expose `esOptativa`
- Web: `PlanCourseSubject` interface + subject-list render (badge + toggle)
- Tests: unit for materialization with plan esOptativa; Prisma repo integration; controller spec

### Out of scope
- `SetMateriaEsOptativaUseCase` / per-CC PATCH (shipped, unchanged)
- Re-gen propagation of esOptativa to existing CCs (excluded — locked in proposal)
- Cascade enrollment behavior (shipped)
- Competency / boletín changes; bulk enrollment

## Open Decisions for Proposal
1. **Re-gen propagation (lock it)**: `MaterializeMateriasUseCase` does NOT update `esOptativa` on existing rows on re-gen. Recommended NO (additive-only).
2. **UI hint**: toggle shows "applies on next CC generation". Recommended yes.
3. **Editing esOptativa on existing plan subject**: covered by upsert re-POST — no new endpoint.
4. **UI placement**: standalone toggle/checkbox in the subject-item row (not inside the name-edit inline state).

## Risks
1. Thin chain across 5 layers / 9 files; each change 1–4 lines; no new patterns.
2. `upsertMany` skipDuplicates on re-gen → existing rows not updated even if plan flag passed. Correct under additive semantics; per-CC PATCH is the remediation. Document for admins.
3. UI hardcoded `hoursPerWeek: 4` at study-plans.tsx line 393 — toggle is additive alongside.
4. No `StudyPlanSubject` domain entity — modeled only via `StudyPlanCourseDto`; flag stays in that DTO shape.
5. PR decomposition: PR1 (schema+domain+infra+app, ~40 lines) → PR2 (presentation+web, ~30–40 lines). Both under 400.

## Files Affected Summary
| File | Change |
|---|---|
| `api/prisma_tenant/schema.prisma` | +1 field |
| `packages/domain/src/pedagogy/repositories/study-plan-repository.ts` | +2 lines |
| `api/src/infrastructure/persistence/prisma/repositories/prisma-study-plan.repository.ts` | +4 lines |
| `api/src/application/pedagogy/use-cases/pedagogy.use-cases.ts` | +1 line |
| `api/src/application/materia-grupo-ciclo/materialize-materias.use-case.ts` | +2 lines |
| `api/src/application/course-cycle/use-cases/course-cycle.use-cases.ts` | +1 line |
| `api/src/presentation/auth/dto/register.request.ts` | +1 line |
| `api/src/presentation/pedagogy/pedagogy.controller.ts` | +3 lines |
| `web/src/pages/dashboard/study-plans.tsx` | +15–25 lines |
