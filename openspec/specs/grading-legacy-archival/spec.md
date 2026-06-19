# Spec — grading-legacy-archival

> Canonical spec — merged from retiro-grading-legacy-s3pre delta · 2026-06-19
> Delivered via: PR #30 (a1 archival script), PR #34 (a2 dead code removal), PR #35 (b DROP migration)
> Schema scope: TENANT only — master schema is unaffected.
> Archival gate: WAIVED — product decision (drop without backup; no data of importance in legacy tables).

---

## Purpose

Archive the five legacy grading tables (`notas`, `evaluaciones`, `notas_trimestrales`,
`periodos_evaluacion`, `subject_assignments`) and remove all dead-code references to them.

After this change, the `teachers` table has no FK consumers in the tenant schema.
That post-condition is the gate prerequisite for S3b-final (drop `teachers`).

---

## Delivery Structure

This change was delivered in three chained PRs:

| PR | Content | Risk | Merge |
|---|---|---|---|
| PR-a1 (#30) | Archival script + tests | LOW | Merged 2026-06-19 |
| PR-a2 (#34) | Dead code removal (no schema change) | LOW | Merged 2026-06-19 |
| PR-b (#35) | DROP migration for the five tables | MEDIUM | Merged 2026-06-19 |

PR-a1 and PR-a2 are reversible via `git revert` with no data consequences.
PR-b rollback requires recreating the five tables from the archival output (archival gate was
WAIVED by product decision — no restoration path is expected to be exercised).

---

## Requirements

### REQ-1 — Archival Script

The file `api/scripts/archive-legacy-grading-data.ts` MUST exist after PR-a1 and MUST
satisfy all of the following:

**REQ-1.1 — Scope**: The script MUST export every row from the five legacy tables
(`notas`, `evaluaciones`, `notas_trimestrales`, `periodos_evaluacion`,
`subject_assignments`) for every active tenant.

**REQ-1.2 — Tenant enumeration**: The script MUST connect to the master DB via the
existing master `PrismaService` pattern to enumerate active tenants before connecting to
each tenant DB.

**REQ-1.3 — Output format**: Each table MUST be exported to a file named
`{tenant-slug}/{table}.{ext}` (CSV or JSON). The format MUST preserve all columns
including FK values to allow data restoration.

**REQ-1.4 — Idempotency**: If the output file for `{tenant-slug}/{table}` already exists
with a non-zero byte count, the script MUST skip re-exporting that table for that tenant.
A re-run against a fully-archived tenant MUST succeed and exit with code 0.

**REQ-1.5 — Per-tenant failure isolation**: On any export failure for a given tenant, the
script MUST abort that tenant's remaining table exports, log the error with the tenant
identifier and table name, and continue with the next tenant. It MUST NOT abort the entire
run due to a single tenant's failure.

**REQ-1.6 — Exit codes**: The script MUST exit with code 0 only if all active tenants
were archived successfully (including skip-on-exists). It MUST exit with code 1 if at
least one tenant's archival failed.

**REQ-1.7 — Empty tables**: A table with zero rows MUST be exported as a file containing
only the header row (CSV) or an empty array (JSON). An empty table MUST NOT be treated as
a failure.

**REQ-1.8 — Gate enforcement**: The archival script MUST be executed and exit with code 0
for all active tenants BEFORE PR-b is applied to any tenant. The DROP migration MUST NOT
be run against a tenant without confirmed successful archival for that tenant.

> **Note**: The archival gate (REQ-1.8) was WAIVED by product decision for this deployment.
> The legacy tables contained no data of importance. The archival script remains in the
> codebase as a safety tool but was not run prior to applying PR-b.

#### Scenario: Successful first-run archival

- GIVEN a system with two active tenants (`alpha`, `beta`)
- AND neither tenant has been previously archived
- WHEN the archival script runs
- THEN it creates `alpha/notas.csv`, `alpha/evaluaciones.csv`, `alpha/notas_trimestrales.csv`,
  `alpha/periodos_evaluacion.csv`, `alpha/subject_assignments.csv`
- AND the same five files for `beta`
- AND the script exits with code 0

#### Scenario: Idempotent re-run — tenant already archived

- GIVEN tenant `alpha` was fully archived in a prior run (all five files exist, non-zero byte count)
- WHEN the archival script runs again
- THEN it skips all five tables for `alpha` without overwriting them
- AND emits no error for `alpha`
- AND exits with code 0 (assuming all other tenants succeed or are also already archived)

#### Scenario: Per-tenant failure — script continues and exits with code 1

- GIVEN tenant `alpha` is already archived
- AND tenant `beta`'s export fails on `notas` (e.g., DB connection error)
- WHEN the archival script runs
- THEN `alpha` is skipped (idempotent, no error)
- AND `beta`'s remaining four tables are NOT attempted after the `notas` failure
- AND the script logs the failure identifying tenant `beta` and table `notas`
- AND the script exits with code 1

#### Scenario: Empty table produces header-only export

- GIVEN a tenant where `notas_trimestrales` has zero rows
- WHEN the archival script archives that tenant
- THEN the file `{tenant-slug}/notas_trimestrales.csv` is created with only the header row
- AND the script does NOT treat this as a failure

---

### REQ-2 — DROP Migration Contract

The Prisma tenant migration introduced in PR-b MUST satisfy:

**REQ-2.1 — Schema scope**: The DROP statements MUST target the tenant schema only
(`api/prisma_tenant/schema.prisma`). The master schema MUST NOT be modified.
The migration MUST be generated and applied via `prisma:migrate:tenant` /
`prisma:migrate:deploy:tenant`.

**REQ-2.2 — FK-safe drop order**: The migration MUST execute DROP statements in this order:
1. `notas` (FK → `evaluaciones.id` via `evaluationId`)
2. `evaluaciones` (FK → `subject_assignments.id` via `assignmentId`)
3. `notas_trimestrales` (FK → `subject_assignments.id` via `assignmentId`
   AND `periodos_evaluacion.id` via `periodId`)
4. `periodos_evaluacion`
5. `subject_assignments` (FK → `teachers.id` via `teacherId`)

No other order is compliant.

**REQ-2.3 — IF EXISTS guards**: Each DROP statement MUST use `DROP TABLE IF EXISTS` to
ensure the migration is safe to re-apply if partially executed.

**REQ-2.4 — Rollback section**: The migration MUST include a down/rollback section that
recreates all five tables with their original columns, FK constraints, and indexes.
This rollback path is documented for emergency reference; given the archival gate was
WAIVED, restoration from archival output is not expected to be exercised.

**REQ-2.5 — Prisma schema cleanup**: The five Prisma models (`Nota`, `Evaluacion`,
`NotaTrimestral`, `PeriodoEvaluacion`, `SubjectAssignment`) MUST be removed from
`api/prisma_tenant/schema.prisma` before generating the migration. The generated client
MUST NOT expose these models after `prisma:generate`.

#### Scenario: DROP executes in FK-safe order without constraint violation

- GIVEN all five legacy tables exist in a tenant schema with referential data
- WHEN the DROP migration is applied
- THEN `notas` is dropped first, then `evaluaciones`, then `notas_trimestrales`,
  then `periodos_evaluacion`, then `subject_assignments`
- AND no FK constraint violation error is raised at any step

#### Scenario: IF EXISTS guard — migration is safe on partial prior run

- GIVEN the migration was previously interrupted after dropping `notas` but before `evaluaciones`
- WHEN the migration is re-applied
- THEN the `IF EXISTS` on `notas` prevents an error on the already-dropped table
- AND the remaining four tables are dropped successfully

#### Scenario: Migration is tenant-scoped, master schema unchanged

- GIVEN the DROP migration is applied
- WHEN the master DB schema is inspected
- THEN no tables in the master schema are affected
- AND the master Prisma client continues to function normally

---

### REQ-3 — Post-Drop Schema and FK State

After PR-b is applied to a tenant, the following MUST hold:

**REQ-3.1 — No FK children on teachers**: The `teachers` table MUST have zero FK
children in the tenant schema. No table MUST reference `teachers.id` via a foreign key.
This is the gate prerequisite for the S3b-final change (drop `teachers`).

**REQ-3.2 — Prisma schema is clean**: `api/prisma_tenant/schema.prisma` MUST NOT contain
model definitions for `Nota`, `Evaluacion`, `NotaTrimestral`, `PeriodoEvaluacion`, or
`SubjectAssignment`.

**REQ-3.3 — Generated client is clean**: After `pnpm --filter api prisma:generate`,
`PrismaClient` MUST NOT expose `prisma.nota`, `prisma.evaluacion`, `prisma.notaTrimestral`,
`prisma.periodoEvaluacion`, or `prisma.subjectAssignment` as properties or methods.

**REQ-3.4 — S3b-final gate**: The change S3b-final (drop `teachers` table) MUST NOT be
started until REQ-3.1 is confirmed on all active tenant databases.

#### Scenario: teachers has no FK children post-drop

- GIVEN the DROP migration has been applied to a tenant
- WHEN `information_schema.table_constraints` is queried for FK constraints referencing `teachers.id`
- THEN zero rows are returned

#### Scenario: Prisma generated client does not expose legacy models

- GIVEN the DROP migration has been applied and `pnpm --filter api prisma:generate` has run
- WHEN the generated TypeScript client is inspected
- THEN `PrismaClient` does NOT have the properties `nota`, `evaluacion`, `notaTrimestral`,
  `periodoEvaluacion`, or `subjectAssignment`
- AND no TypeScript type for these models is exported from the Prisma client package

---

### REQ-4 — Code Cleanliness After PR-a2

After PR-a2 is merged, the codebase MUST NOT contain any of the following:

**REQ-4.1 — Strategy files deleted**: All seven files in
`api/src/application/shared/strategies/` (`evaluacion.strategy.ts`,
`evaluacion-inicial.strategy.ts`, `evaluacion-primario.strategy.ts`,
`evaluacion-secundario.strategy.ts`, `evaluacion-terciario.strategy.ts`,
`evaluacion-strategy.factory.ts`, `index.ts`) MUST be deleted. No import of these files
MUST remain in any other file.

**REQ-4.2 — Legacy path removed from generate-boletin**: `generate-boletin.use-case.ts`
MUST NOT contain the identifiers `NotaTrimestral`, `notaTrimestral`,
`resolveDocentesForStudentCC`, `CourseCycles` (used only in the legacy path), or
`SubjectAssignment` in any branch of `buildMaterias()`.

**REQ-4.3 — Domain entities deleted**: The domain entity files
`packages/domain/src/pedagogy/entities/subject-assignment.ts`,
`evaluacion.ts`, `nota-trimestral.ts`, `periodo-evaluacion.ts`, and `nota.ts`
MUST be deleted from `packages/domain/src/pedagogy/entities/`.

**REQ-4.4 — Domain repository interfaces deleted**: The repository interface files
`packages/domain/src/pedagogy/repositories/subject-assignment-repository.ts`,
`evaluacion-repository.ts`, `nota-trimestral-repository.ts`, and
`periodo-evaluacion-repository.ts` MUST be deleted.

**REQ-4.5 — Exports cleaned**: `packages/domain/src/pedagogy/index.ts` and
`packages/domain/src/index.ts` MUST NOT export `SubjectAssignment`, `Evaluacion`,
`NotaTrimestral`, `PeriodoEvaluacion`, `Nota`, or any of their repository interfaces.

**REQ-4.6 — Stale test mocks removed**: The mock factory in
`generate-boletin.use-case.test.ts` and `generate-boletin.docente-s2.test.ts` MUST NOT
include the keys `subjectAssignment`, `notaTrimestral`, or `periodoEvaluacion` in any
tenant Prisma client mock. All existing tests MUST continue to pass after mock cleanup.

#### Scenario: Strategy directory is empty post-PR-a2

- GIVEN the codebase after PR-a2 is merged
- WHEN searching for `evaluacion-strategy.factory.ts` or any of the seven sibling files
- THEN no such files exist in `api/src/application/shared/strategies/`
- AND no import statement for these files exists anywhere in the codebase

#### Scenario: generate-boletin.use-case.ts has no legacy-path identifiers

- GIVEN `generate-boletin.use-case.ts` after PR-a2
- WHEN the file is searched for the strings `NotaTrimestral`, `notaTrimestral`,
  `resolveDocentesForStudentCC`, or `SubjectAssignment`
- THEN none of these identifiers appear in the file

#### Scenario: Domain package exports no legacy grading symbols

- GIVEN `packages/domain/src/index.ts` after PR-a2
- WHEN the exported symbols are enumerated
- THEN `SubjectAssignment`, `Evaluacion`, `NotaTrimestral`, `PeriodoEvaluacion`, `Nota`,
  `SubjectAssignmentRepository`, `EvaluacionRepository`, `NotaTrimestralRepository`,
  and `PeriodoEvaluacionRepository` are NOT present

#### Scenario: Boletín tests pass after stale mock removal

- GIVEN `generate-boletin.use-case.test.ts` and `generate-boletin.docente-s2.test.ts`
  after PR-a2, with `subjectAssignment`, `notaTrimestral`, and `periodoEvaluacion` keys
  removed from all tenant Prisma mock factories
- WHEN `pnpm --filter api test` runs
- THEN all tests in those files MUST pass
- AND no test MUST reference removed mock keys

---

### REQ-5 — Delivery Gate: PR-b Preconditions

PR-b (DROP migration) MUST NOT be applied to any tenant unless all of the following
conditions are met:

1. PR-a1 and PR-a2 are merged into the main branch and deployed to the target environment.
2. The archival script (`api/scripts/archive-legacy-grading-data.ts`) has completed
   with exit code 0 for all active tenants.
3. Archival output files exist on disk for all five tables for every active tenant.

> **Note**: Conditions 2 and 3 were WAIVED by product decision for this deployment.
> The legacy tables contained no data of importance. PR-b was applied without running
> the archival script. The archival script remains in the codebase as a safety tool.

Condition 3 SHOULD be verified by a pre-migration check before executing DROP statements.

#### Scenario: Gate passes — all preconditions met

- GIVEN PR-a1 and PR-a2 are deployed
- AND the archival script exited with code 0 for all active tenants
- AND archival files exist for all five tables per tenant
- WHEN the operator applies PR-b migration
- THEN the DROP statements execute without error
- AND all five tables are removed from each tenant schema

#### Scenario: Gate fails — archival not run for a tenant

- GIVEN the archival script has NOT been run for tenant `gamma`
- WHEN the pre-migration check runs for `gamma`
- THEN the check SHOULD detect missing archival output for `gamma`
- AND the migration SHOULD abort or emit a blocking warning before executing DROP for `gamma`
