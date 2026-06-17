# Spec: drop-homeroom-teacher-id

> Phase: sdd-spec · Change: retiro-homeroom-column-s3b0 · 2026-06-17
> Scope: Drop `CourseCycle.homeroomTeacherId` column, FK, index, schema entry, entity field/methods, mapper references, and obsolete backfill scripts.

---

## 1. Context

S3a migrated homeroom navigation to `AsignacionCursoXCiclo(TITULAR)`. After that migration, `CourseCycle.homeroomTeacherId` has zero functional readers: no port, no use-case, no controller or DTO references it. This spec defines what MUST be true after the change is applied. It does NOT define how.

---

## 2. Delta Requirements (RFC 2119)

### 2.1 Database — Tenant Schema

**REQ-DB-1** The `course_cycles` table MUST NOT contain a column named `homeroom_teacher_id` after the migration is applied.

**REQ-DB-2** The FK constraint `course_cycles_homeroom_teacher_id_fkey` MUST NOT exist after the migration is applied.

**REQ-DB-3** The index `course_cycles_homeroom_teacher_id_idx` MUST NOT exist after the migration is applied.

**REQ-DB-4** The migration MUST be a hand-written SQL file placed in `api/prisma_tenant/migrations/` following the project's naming convention (`<timestamp>_drop_homeroom_teacher_id/migration.sql`).

**REQ-DB-5** The migration file MUST include a commented rollback DDL block that documents how to restore the column, FK, and index. The rollback MUST be executable without further context lookup.

**REQ-DB-6** The migration MUST be applied per-tenant via `pnpm --filter api migrate-tenants` (the project's multi-tenant deploy path). No manual per-tenant SQL is acceptable as the sole deploy mechanism.

**REQ-DB-7** The `teachers` table MUST remain intact — no columns, rows, indexes, or FKs on the `teachers` table other than `courseCyclesHomeroom` back-relation references MUST be modified.

### 2.2 Prisma Schema

**REQ-SCHEMA-1** `CourseCycle` model in `api/prisma_tenant/schema.prisma` MUST NOT declare the field `homeroomTeacherId`, the relation `homeroomTeacher`, or the `@@index([homeroomTeacherId])` directive.

**REQ-SCHEMA-2** `Teacher` model in `api/prisma_tenant/schema.prisma` MUST NOT declare the back-relation `courseCyclesHomeroom CourseCycle[]`.

**REQ-SCHEMA-3** After applying REQ-SCHEMA-1 and REQ-SCHEMA-2, running `pnpm --filter api prisma:generate` MUST complete with exit code 0 and zero validation errors.

### 2.3 Domain Entity

**REQ-ENTITY-1** The `CourseCycle` domain entity (`packages/domain/src/course-cycle/entities/course-cycle.ts`) MUST NOT expose a property `homeroomTeacherId`.

**REQ-ENTITY-2** The `CourseCycle` entity MUST NOT expose a getter for `homeroomTeacherId`.

**REQ-ENTITY-3** The `CourseCycle` entity MUST NOT expose a method `assignHomeroomTeacher()`.

**REQ-ENTITY-4** The `CourseCycle` entity MUST expose all properties and methods it exposed before this change that are unrelated to `homeroomTeacherId`.

### 2.4 Repository Mapper

**REQ-MAPPER-1** The `toDomain` function in `prisma-course-cycle.repository.ts` MUST NOT read or pass through `homeroomTeacherId` from the Prisma result object.

**REQ-MAPPER-2** The `toPersistence` function in the same file MUST NOT write or pass through `homeroomTeacherId` to the Prisma input object.

### 2.5 Test Cleanup

**REQ-TEST-1** The entity spec (`course-cycle.spec.ts`) MUST NOT contain a `describe` block or individual `it`/`test` cases that reference `homeroomTeacherId` or `assignHomeroomTeacher`.

**REQ-TEST-2** The repository spec (`prisma-course-cycle.repository.spec.ts`) MUST NOT pass `homeroomTeacherId` to the course-cycle factory helper.

### 2.6 Backfill Scripts

**REQ-BACKFILL-1** After the change is applied, `pnpm --filter api typecheck` (`tsc --noEmit`) MUST exit with code 0. The two scripts that reference `homeroomTeacherId` (`backfill-asignacion-curso.ts`, `backfill-docente-x-ciclo.ts`) and their tests MUST be handled so they no longer cause type errors.

> **DESIGN-OWNED:** The exact mechanism — deleting the files entirely vs. excluding them from `tsconfig` compilation — is a design decision and MUST be documented in the design artifact. The spec only requires that tsc passes.

### 2.7 Functional Behavior

**REQ-FUNC-1** All CourseCycle CRUD operations (create, read, update, list, delete) MUST behave identically before and after this change. No regression in response shape, HTTP status codes, or business logic is acceptable.

**REQ-FUNC-2** No other `Teacher` consumer (teacher routes, exam boards, Sala/Grado/Curso, S3b-next slices) MUST be modified by this change.

### 2.8 Deploy Precondition (Operational)

**REQ-DEPLOY-1** Before `migrate-tenants` is executed, the Fase 4 TITULAR backfill MUST be verified complete (skip count = 0) for every active tenant. Applying the migration on a tenant with `skip > 0` is an accepted data-loss risk, explicitly acknowledged here: CCs that were skipped during the TITULAR backfill will permanently lose their `homeroomTeacherId` value, and the recovery script will no longer exist in the active codebase.

**REQ-DEPLOY-2** The deploy runbook (in the PR description or a linked doc) MUST include the skip-count verification query and the go/no-go gate before running `migrate-tenants`.

---

## 3. Acceptance Scenarios

### Scenario 1 — Migration removes column, FK, and index

```
Given  a tenant database where course_cycles has the homeroom_teacher_id column,
       the FK course_cycles_homeroom_teacher_id_fkey, and the index course_cycles_homeroom_teacher_id_idx
When   the migration file is applied via prisma migrate deploy
Then   the column homeroom_teacher_id MUST NOT exist in course_cycles
And    the FK constraint MUST NOT exist
And    the index MUST NOT exist
And    all other columns in course_cycles MUST remain unchanged
```

### Scenario 2 — Migration rollback is documented and executable

```
Given  the migration file at api/prisma_tenant/migrations/<timestamp>_drop_homeroom_teacher_id/migration.sql
When   a DBA reads the file
Then   a commented rollback DDL block MUST be present
And    it MUST contain the ADD COLUMN, ADD CONSTRAINT, and CREATE INDEX statements
       needed to restore the prior state without consulting any external doc
```

### Scenario 3 — Prisma generate passes after schema cleanup

```
Given  the updated schema.prisma with both relation sides removed
When   pnpm --filter api prisma:generate is executed
Then   the command MUST exit 0
And    zero schema validation errors MUST be reported
And    the generated Prisma client MUST NOT expose homeroomTeacherId on CourseCycleWhereInput or CourseCycleCreateInput types
```

### Scenario 4 — Domain entity does not expose homeroom fields

```
Given  the updated course-cycle.ts entity
When   a TypeScript consumer imports CourseCycle
Then   accessing .homeroomTeacherId MUST produce a compile-time type error (property does not exist)
And    calling .assignHomeroomTeacher() MUST produce a compile-time type error (method does not exist)
And    all other public properties and methods of CourseCycle MUST remain accessible
```

### Scenario 5 — Mapper does not pass through homeroom data

```
Given  a Prisma CourseCycle row (without homeroom_teacher_id)
When   toDomain() is called
Then   the resulting CourseCycle domain object MUST NOT have a homeroomTeacherId property

Given  a CourseCycle domain object
When   toPersistence() is called
Then   the resulting Prisma input object MUST NOT include a homeroomTeacherId key
```

### Scenario 6 — CourseCycle CRUD is unaffected

```
Given  the API is deployed with the updated code and migration applied
When   a client calls any CourseCycle endpoint (create, read, update, list, delete)
Then   the response shape, HTTP status, and business logic MUST be identical to pre-change behavior
And    no 500 errors attributable to the removal MUST occur
```

### Scenario 7 — Teacher table is untouched

```
Given  the migration runs on a tenant
When  inspect is run on the teachers table
Then   all columns other than the removed back-relation reference MUST remain
And    all existing teacher records MUST be present with unaltered data
And    no other FK referencing teachers MUST be dropped
```

### Scenario 8 — Typecheck passes after backfill script handling

```
Given  the updated codebase (backfill scripts handled per design decision)
When   pnpm --filter api typecheck is executed
Then   the command MUST exit 0
And    zero new TypeScript errors MUST be reported (relative to the pre-change baseline excluding the known backfill errors)
```

### Scenario 9 — Deploy precondition gate

```
Given  a tenant with skip_count > 0 for the Fase 4 TITULAR backfill
When   the team follows the deploy runbook
Then   the runbook MUST require manual confirmation or automated gate before allowing migrate-tenants to run
And    the consequence (permanent data loss for skipped CCs) MUST be documented in the runbook
```

---

## 4. Out of Scope

The following are explicitly NOT part of this spec:

- Any other `Teacher` consumer: teacher routes, exam boards, Sala/Grado/Curso entities, other S3b slices.
- The `teachers` table structure or data.
- The homeroom use-case (removed in S3a).
- The `generator erd` block in schema.prisma.
- Any behavior of `AsignacionCursoXCiclo(TITULAR)` — this is read-only context.

---

## 5. Open / Design-Owned Decisions

| ID   | Item                                                                                                             | Owner  |
|------|------------------------------------------------------------------------------------------------------------------|--------|
| D-1  | Whether `backfill-asignacion-curso.ts`, `backfill-docente-x-ciclo.ts`, and their tests are **deleted** from the repo or **excluded from tsconfig compilation**. Either satisfies REQ-BACKFILL-1. | Design |

---

## 6. Assumptions Made During Spec

- Constraint name `course_cycles_homeroom_teacher_id_fkey` and index name `course_cycles_homeroom_teacher_id_idx` confirmed from `20260609140000_grading_primario_add_teacher_user_and_homeroom` migration (explore artifact).
- The column has no Restrict FK pointing to it from any other table — confirmed in explore artifact ("Sin FKs Restrict").
- No functional reader of `homeroomTeacherId` exists anywhere in the codebase post-S3a — confirmed in explore artifact ("Cero lectores").
- Staged deploy is NOT required — explore artifact confirms no restrict FK, drop is clean.
