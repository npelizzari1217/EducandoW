# Delta Spec: exam-presidente-user

> Change: retiro-examenes-presidente-s3b3
> Phase: sdd-spec · Store: hybrid · 2026-06-17
> Scope: ALL (SECUNDARIO + TERCIARIO) — schema + migration only; zero code change.
> Closes: R-GAP de S3b-2 (presidenteId desacoplado de Teacher).

---

## 1. Context

`MesaExamen.presidenteId` and `ActaExamen.presidenteId` currently store a `Teacher.id`
and carry `RESTRICT` FK constraints back to `teachers`. After S3b-2 eliminated all
Teacher-row creation paths, these FKs are the sole coupling preventing any `User` from
being appointed presidente without a `Teacher` row. This spec describes the required
post-migration state.

---

## 2. Requirements (RFC 2119)

### R-1 — Column semantics

`MesaExamen.presidenteId` and `ActaExamen.presidenteId` MUST store a `User.id` from the
master database. This is an AD-6 cross-database reference: a UUID string with no
enforced FK in the tenant database. The columns MUST remain `TEXT NOT NULL`.

### R-2 — FK constraints removed

The Restrict FK constraints MUST be absent after migration:

- `mesas_examen_presidente_id_fkey` MUST NOT exist in the tenant schema.
- `actas_examen_presidente_id_fkey` MUST NOT exist in the tenant schema.

No new FK referencing `teachers` or any other table MUST be introduced on these columns.

### R-3 — Indexes preserved

The existing indexes on `presidente_id` MUST be retained:

- `mesas_examen_presidente_id_idx` MUST remain.
- `actas_examen_presidente_id_idx` MUST remain.

### R-4 — Backfill: well-formed rows

Every existing `mesas_examen` row whose current `presidente_id` equals a `teachers.id`
where that teacher's `user_id IS NOT NULL` MUST have its `presidente_id` updated to
`teachers.user_id` before the FK drop executes.

The same rule MUST apply to `actas_examen` rows.

The backfill and the FK drops MUST execute in a single migration file in sequential
order: backfill first, drop second — with no gap between them.

### R-5 — Orphan handling (Option B)

Rows whose `presidente_id` maps to a `teachers.id` where `user_id IS NULL` MUST NOT
block or error during migration. Those rows retain the old `Teacher.id` as a dangling
UUID value. This is accepted behavior under Option B. The migration MUST NOT abort on
the presence of such orphans.

### R-6 — R-GAP closure

After migration, creating a `MesaExamen` or `ActaExamen` with any valid `User.id` as
`presidenteId` MUST succeed without requiring a corresponding `Teacher` row in the
tenant database.

### R-7 — Prisma model changes

The `Teacher` Prisma model MUST NOT declare a `mesasExamen MesaExamen[]` back-relation
after this change.

The `Teacher` Prisma model MUST NOT declare an `actasExamen ActaExamen[]` back-relation
after this change.

`MesaExamen.presidente` and `ActaExamen.presidente` relation fields pointing to `Teacher`
MUST be removed from the Prisma schema.

The `Teacher` model and its underlying `teachers` table MUST be retained (still consumed
by `SubjectAssignment.teacherId`).

### R-8 — Zero code change

No files outside `api/prisma_tenant/schema.prisma`, the tenant migration directory, and
spec documents MUST be modified by this change. Domain entities, application use cases,
infrastructure repositories, DTOs, frontend components, and tests MUST remain untouched.

`presidenteId` MUST remain validated as `z.string().uuid()` in all DTOs; this validator
is semantically correct for `User.id`.

### R-9 — Migration reversibility

The migration file MUST include a commented rollback DDL block. The rollback block MUST
re-create the two FK constraints (structure only — data reversal is out of scope and not
required).

### R-10 — Build integrity

After applying this change:

- `prisma generate` MUST complete without errors or warnings for the tenant schema.
- `tsc --noEmit` (typecheck) MUST report zero new errors compared to baseline.
- The full test suite (`pnpm test`) MUST remain green.

---

## 3. Acceptance Scenarios

### Scenario 1 — Happy-path backfill

**Given** a tenant database where every `teachers` row has `user_id IS NOT NULL`
**When** the migration runs
**Then** every `mesas_examen.presidente_id` and `actas_examen.presidente_id` value is
a `User.id` (UUID present in the master `users` table),
**And** neither `mesas_examen_presidente_id_fkey` nor `actas_examen_presidente_id_fkey`
exists in the `information_schema.table_constraints`.

### Scenario 2 — Orphan rows do not block migration

**Given** a tenant database that contains at least one `teachers` row with `user_id IS NULL`,
and that teacher's id appears in `mesas_examen.presidente_id`
**When** the migration runs
**Then** the migration completes successfully without error,
**And** the affected `mesas_examen.presidente_id` retains the original `Teacher.id`
as its value (dangling UUID, accepted),
**And** all FK constraints described in R-2 are absent.

### Scenario 3 — New MesaExamen with User.id only (R-GAP)

**Given** a `User.id` that has no corresponding row in the `teachers` table
**When** a `CreateMesaExamen` command is executed with that `User.id` as `presidenteId`
**Then** a `MesaExamen` row is persisted successfully,
**And** no foreign-key violation or application error is raised.

### Scenario 4 — New ActaExamen with User.id only (R-GAP)

**Given** a `User.id` that has no corresponding row in the `teachers` table
**When** a `CreateActaExamen` command is executed with that `User.id` as `presidenteId`
**Then** an `ActaExamen` row is persisted successfully,
**And** no foreign-key violation or application error is raised.

### Scenario 5 — Schema generation clean

**Given** the updated `api/prisma_tenant/schema.prisma` (back-relations removed, relation
fields removed)
**When** `prisma generate` runs
**Then** it exits with code 0,
**And** no TypeScript type errors referencing `Teacher.mesasExamen` or `Teacher.actasExamen`
exist in generated client types,
**And** `tsc --noEmit` for the `api` workspace exits with code 0.

### Scenario 6 — Indexes survive the migration

**Given** a tenant database after the migration has run
**When** the index catalog is queried (`pg_indexes` or `\d mesas_examen`)
**Then** `mesas_examen_presidente_id_idx` exists,
**And** `actas_examen_presidente_id_idx` exists.

### Scenario 7 — Rollback DDL is present

**Given** the migration SQL file
**When** a reviewer inspects its content
**Then** a clearly delimited rollback section exists as SQL comments or a DOWN block,
**And** it contains `ADD CONSTRAINT mesas_examen_presidente_id_fkey` and
`ADD CONSTRAINT actas_examen_presidente_id_fkey` DDL (structure only).

### Scenario 8 — Test suite stays green

**Given** the schema change and zero application-code change
**When** `pnpm test` runs against the updated codebase
**Then** all existing tests pass,
**And** no test references `Teacher.mesasExamen` or `Teacher.actasExamen` in a way that
would cause a compile or runtime error.

---

## 4. Out of Scope

The following are explicitly excluded from this spec and MUST NOT be implemented as part
of this change:

- Cleaning up dangling orphan UUIDs (deferred; revisit only if name-display is added).
- Dropping the `teachers` table or the `Teacher` Prisma model (gated by S3-pre /
  SubjectAssignment decoupling).
- Any change to `ActaExamen.vocales` (already free-form, no FK).
- Nullability change to `presidenteId` (stays `NOT NULL`).
- Generator `erd` or any Prisma generator change.
- Any display or resolution of the presidente's name.

---

## 5. Assumptions Made at Spec Level

- **A-1**: The FK constraint names in production match those found in the explore artifact
  (`mesas_examen_presidente_id_fkey`, `actas_examen_presidente_id_fkey`). If a tenant
  uses a different name (schema drift), `DROP CONSTRAINT IF EXISTS` handles it silently.
- **A-2**: `Teacher.userId` is the correct source for backfill (confirmed in explore:
  same AD-6 pattern as `DocenteXCiclo.userId`).
- **A-3**: No application layer reads or writes `Teacher.mesasExamen` /
  `Teacher.actasExamen` at runtime; confirmed in explore (no `include:{presidente}` in
  repos, no name display anywhere).
- **A-4**: The migration is applied per-tenant via `migrate-tenants` tooling; no global
  migration is needed.
