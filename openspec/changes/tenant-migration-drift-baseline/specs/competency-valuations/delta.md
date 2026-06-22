# Delta: tenant-migration-drift-baseline → competency-valuations

> Change: tenant-migration-drift-baseline
> Date: 2026-06-22
> Capability: competency-valuations
> Canonical spec: openspec/specs/competency-valuations/spec.md
> Pedagogical level: NONE (infra/correctness — no user-facing behaviour change beyond correctness)
> IDs added: CV-R9 / CV-S21–CV-S22
> Numbering note: assumes canonical spec ends at CV-R8 / CV-S20. MUST be verified against
>   openspec/specs/competency-valuations/spec.md before archival and IDs adjusted if needed.

## Context

Migration `20260608201000_competency_scope_remodel` created a 2-column UNIQUE INDEX on
`competency_valuations` via `CREATE UNIQUE INDEX "competency_valuations_studentId_competencyId_key"`.

Migration `20260608210000_competency_instantiation_fase3` (Step 3) intended to remove it with
`ALTER TABLE "competency_valuations" DROP CONSTRAINT IF EXISTS "competency_valuations_studentId_competencyId_key"`.
That statement silently no-ops when the target object is an INDEX created by `CREATE UNIQUE INDEX`
rather than a named CONSTRAINT — a PostgreSQL distinction where `DROP CONSTRAINT IF EXISTS` does not
act on indexes. The index remained in the database.

The same migration (Step 4) correctly added the superseding 3-column UNIQUE CONSTRAINT
`(studentId, competencyId, course_cycle_id)`. In practice both the stranded 2-col index and the
correct 3-col constraint coexisted in the DB, with the 2-col index being the more restrictive one
and effectively blocking the 3-col uniqueness model.

This change corrects the residual state by dropping the stranded 2-col index via `DROP INDEX`
(which correctly targets an index, unlike `DROP CONSTRAINT`).

## Requirements added

### CV-R9 — Uniqueness of CompetenciaXMateriaXAlumnoXCursoXCiclo MUST be scoped to CourseCycle

The uniqueness constraint enforced on the `competency_valuations` table MUST be the 3-column
key `(studentId, competencyId, courseCycleId)`. No 2-column unique index or constraint on
`(studentId, competencyId)` alone MUST exist in the database. A student MAY hold a
`CompetenciaXMateriaXAlumnoXCursoXCiclo` row for the same competency in multiple CourseCycles
simultaneously; no business rule prevents or restricts this.

## Acceptance scenarios

### CV-S21 — Same student + competency in two different CourseCycles is accepted

**Given** student S has a `CompetenciaXMateriaXAlumnoXCursoXCiclo` row for competency C scoped to CourseCycle CC1
**When** a `CompetenciaXMateriaXAlumnoXCursoXCiclo` row is created for the same student S and the same competency C scoped to a different CourseCycle CC2
**Then** the insert MUST succeed
**And** both rows MUST persist independently in the database

### CV-S22 — Duplicate within the same CourseCycle is rejected

**Given** student S has a `CompetenciaXMateriaXAlumnoXCursoXCiclo` row for competency C scoped to CourseCycle CC1
**When** an insert of a second row for the same (student S, competency C, CourseCycle CC1) triple is attempted
**Then** the operation MUST fail with a unique-constraint violation
**And** no duplicate row MUST be created
