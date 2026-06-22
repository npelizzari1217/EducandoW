# Delta: smart-course-creation — Optativa a nivel plan de estudios

> Capability: smart-course-creation (MODIFIED)
> Change: optativa-plan-level
> Base spec: openspec/specs/smart-course-creation/spec.md
> Pedagogical level: ALL — generic; applies to every level using study plans + the grupo model

## Context

This delta extends "CursoXCiclo Generation Materializes Plan Subjects" (introduced by
`docente-ciclo-grupos` · Fase 3, decision D1 additive) to propagate `esOptativa` from
`StudyPlanSubject` into `MateriaXCursoXCiclo` at materialization time. `upsertMany`
already accepts `esOptativa`; the gap is in the upstream chain:
`StudyPlanCourseDto.subjects[]` → `GenerateCourseCyclesUseCase` → `MaterializeMateriasUseCase`.
The `createMany skipDuplicates` strategy (D1) is unchanged, which automatically preserves
`esOptativa` on already-materialized rows.

---

## MODIFIED Requirements

### Requirement: CursoXCiclo Generation Propagates `esOptativa` from Plan Subject

> Extends: "CursoXCiclo Generation Materializes Plan Subjects" (base spec, re-gen D1).

When `GenerateCourseCyclesUseCase` builds the `PlanSubjectInput` list for
`MaterializeMateriasUseCase`, each entry MUST include the `esOptativa` value sourced
from the corresponding `StudyPlanSubject`. `esOptativa` MUST be forwarded through every
layer of the chain: `StudyPlanCourseDto` → use case input → `upsertMany` payload.

The `createMany skipDuplicates` strategy already used for re-generation (D1) is unchanged.
Because duplicate rows are skipped rather than updated, `esOptativa` on already-materialized
rows is NEVER overwritten — preserving manual PATCH overrides (MGC-R10) and the additive
re-gen semantics (MGC-R15).

#### Scenario: Generation propagates esOptativa from each plan subject to its CC row

- GIVEN a study plan with subject SPS1 (`esOptativa = true`) and SPS2 (`esOptativa = false`)
- WHEN a `CursoXCiclo` is generated from that plan
- THEN the `MateriaXCursoXCiclo` for SPS1 has `esOptativa = true`
- AND the `MateriaXCursoXCiclo` for SPS2 has `esOptativa = false`

#### Scenario: Generation with all obligatoria subjects produces no optativa CC rows

- GIVEN a study plan with 4 subjects all having `esOptativa = false`
- WHEN a `CursoXCiclo` is generated from that plan
- THEN all 4 `MateriaXCursoXCiclo` rows have `esOptativa = false`
- AND no row is created with `esOptativa = true`

#### Scenario: Re-generation (D1 skipDuplicates) does not overwrite existing esOptativa on CC rows

- GIVEN `CursoXCiclo` CC1 was generated from plan P with SPS1 (`esOptativa = false`) and SPS2 (`esOptativa = false`)
- AND the `MateriaXCursoXCiclo` M1 for SPS1 was subsequently toggled to `esOptativa = true` via PATCH (MGC-R10)
- AND SPS2 is updated on the plan to `esOptativa = true`
- WHEN CC1 is re-generated
- THEN `M1.esOptativa` remains `true` (PATCH override preserved; `skipDuplicates` bypassed M1)
- AND `M2.esOptativa` remains `false` (existing row not overwritten by the plan change)
- AND no rows are removed or modified; only new-subject rows would be inserted
