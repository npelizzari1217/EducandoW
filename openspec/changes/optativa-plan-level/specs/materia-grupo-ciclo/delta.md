# Delta: materia-grupo-ciclo — Optativa a nivel plan de estudios

> Capabilities: materia-grupo-ciclo (MODIFIED)
> Change: optativa-plan-level
> Base spec: openspec/specs/materia-grupo-ciclo/spec.md
> Pedagogical level: ALL — generic; applies to every level using study plans + the grupo model (INICIAL, PRIMARIO, SECUNDARIO, TERCIARIO)
> IDs added: MGC-R13–MGC-R16 / MGC-S28–MGC-S38

## Context

`optativas-inscripcion` (MGC-R7–MGC-R12) placed `esOptativa` on `MateriaXCursoXCiclo`
and provided a per-CC PATCH toggle (MGC-R10). Admins must still mark each materia
optativa CC-by-CC after every generation — repetitive for institutions with many
CourseCycles. This delta moves the designation upstream to `StudyPlanSubject` so that
new CCs inherit the flag automatically at materialization time. The per-CC PATCH override
(MGC-R10) remains authoritative and is NEVER overwritten by a plan change or re-generation.

---

## ADDED Requirements

### MGC-R13 — `esOptativa` on `StudyPlanSubject`

`StudyPlanSubject` MUST carry a boolean field `esOptativa` (`@default(false)`). This field
represents the plan-level designation: whether the subject is elective within the study
plan. No backfill SHALL be applied to pre-existing `StudyPlanSubject` rows; they retain
the migration default (`false`, obligatoria).

#### MGC-S28 — New plan subject defaults to esOptativa = false

- GIVEN a study plan P with no subjects
- WHEN a subject is added to P without specifying `esOptativa`
- THEN the `StudyPlanSubject` record has `esOptativa = false`

#### MGC-S29 — Plan subject can be marked optativa on creation

- GIVEN a study plan P
- WHEN `POST /study-plan-courses/:id/subjects` is called with `{ ..., esOptativa: true }`
- THEN the `StudyPlanSubject` record is created with `esOptativa = true`
- AND subsequent reads of that subject return `esOptativa: true`

---

### MGC-R14 — Materialization inherits `esOptativa` from `StudyPlanSubject`

When `GenerateCourseCyclesUseCase` materializes subjects for a new `CursoXCiclo`, each
`MateriaXCursoXCiclo` row created MUST receive `esOptativa` equal to the value of
`esOptativa` on its source `StudyPlanSubject`. The plan-level designation IS the default
value at materialization time; it is not a post-generation step.

#### MGC-S30 — Generated CC row inherits esOptativa = true from plan subject

- GIVEN `StudyPlanSubject` SPS with `esOptativa = true`
- WHEN a `CursoXCiclo` is generated from a plan that includes SPS
- THEN the corresponding `MateriaXCursoXCiclo` has `esOptativa = true`

#### MGC-S31 — Generated CC row inherits esOptativa = false from plan subject

- GIVEN `StudyPlanSubject` SPS with `esOptativa = false`
- WHEN a `CursoXCiclo` is generated from a plan that includes SPS
- THEN the corresponding `MateriaXCursoXCiclo` has `esOptativa = false`

#### MGC-S32 — Mixed plan: each CC row inherits from its own plan subject

- GIVEN a study plan P with subjects: SPS1 (`esOptativa = false`), SPS2 (`esOptativa = true`), SPS3 (`esOptativa = false`)
- WHEN a `CursoXCiclo` is generated from P
- THEN `MateriaXCursoXCiclo` for SPS1 has `esOptativa = false`
- AND `MateriaXCursoXCiclo` for SPS2 has `esOptativa = true`
- AND `MateriaXCursoXCiclo` for SPS3 has `esOptativa = false`

#### MGC-S33 — Plan subject flipped to optativa before first generation

- GIVEN `StudyPlanSubject` SPS was initially created with `esOptativa = false`
- AND SPS is re-upserted via POST with `esOptativa = true` before any `CursoXCiclo` is generated
- WHEN a `CursoXCiclo` is generated from the plan containing SPS
- THEN the `MateriaXCursoXCiclo` for SPS is born with `esOptativa = true`

---

### MGC-R15 — Re-generation is additive; existing `MateriaXCursoXCiclo.esOptativa` is immutable

Re-generating a `CursoXCiclo` (D1: additive, `createMany skipDuplicates`) MUST NOT update
`esOptativa` on any already-materialized `MateriaXCursoXCiclo` row. Only rows inserted by
the current re-generation receive the plan-subject default. This rule preserves manual PATCH
overrides (MGC-R10): if an admin toggled a row via PATCH after the initial generation, that
value SHALL survive both a plan-subject edit and any subsequent re-generation.

#### MGC-S34 — Re-gen after plan flip: existing CC rows unchanged

- GIVEN `CursoXCiclo` CC1 was generated from a plan where SPS had `esOptativa = false`
- AND the resulting `MateriaXCursoXCiclo` M has `esOptativa = false`
- AND SPS is updated on the plan to `esOptativa = true`
- WHEN CC1 is re-generated
- THEN `M.esOptativa` remains `false` (the existing row was skipped by `skipDuplicates`)
- AND no `MateriaXCursoXCiclo` rows are removed or modified; the operation is purely additive

#### MGC-S35 — PATCH override survives plan edit and re-gen

- GIVEN `MateriaXCursoXCiclo` M was born with `esOptativa = false` (inherited from plan default)
- AND an admin applied PATCH to set `M.esOptativa = true` (MGC-R10)
- AND the source `StudyPlanSubject` SPS is later updated to `esOptativa = false`
- WHEN CC1 is re-generated
- THEN `M.esOptativa` remains `true` (the PATCH override is preserved; `skipDuplicates` skipped M)
- AND the plan-level value DOES NOT overwrite the materialized row

#### MGC-S36 — Re-gen for a new plan subject creates a row with the current plan esOptativa

- GIVEN `CursoXCiclo` CC1 was generated from plan P (3 subjects); no row exists for SPS4
- AND a new subject SPS4 with `esOptativa = true` is added to P after the initial generation
- WHEN CC1 is re-generated
- THEN a new `MateriaXCursoXCiclo` for SPS4 is created with `esOptativa = true`
- AND the 3 existing `MateriaXCursoXCiclo` rows are unchanged

---

### MGC-R16 — Plan-subject API accepts and exposes `esOptativa`

`POST /study-plan-courses/:id/subjects` (upsert) MUST accept `esOptativa` (boolean,
optional, default `false`) in the request body and persist it on `StudyPlanSubject` via
the Prisma `update:` clause (so the value is set on both insert and re-upsert). Every
endpoint that returns plan-subject data MUST include `esOptativa` in the response payload.
Consumers MUST be able to distinguish optativa from obligatoria plan subjects without a
separate request.

#### MGC-S37 — Plan subject upsert updates esOptativa on existing record

- GIVEN a `StudyPlanSubject` SPS with `esOptativa = false`
- WHEN `POST /study-plan-courses/:id/subjects` is called with `{ esOptativa: true }` for the same subject
- THEN the existing `StudyPlanSubject` record is updated: `esOptativa = true`
- AND no duplicate row is created

#### MGC-S38 — GET plan subjects response includes esOptativa per entry

- GIVEN plan P has subjects SPS1 (`esOptativa = false`) and SPS2 (`esOptativa = true`)
- WHEN `GET /study-plan-courses/:planId` (or the equivalent subjects endpoint) is called
- THEN the response for SPS1 includes `esOptativa: false`
- AND the response for SPS2 includes `esOptativa: true`
