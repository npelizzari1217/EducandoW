# Tenant Database Specification

## Purpose

Define how a new institution triggers the creation of its isolated tenant database, including migration execution and failure rollback. (Implements R2, R8, R10)

## Requirements

### Requirement: Automatic Tenant DB Creation

When a ROOT user creates an institution via `POST /v1/institutions`, the system MUST atomically:

1. Insert the `Institution` record into the master DB (`educandow_master`) with `db_name` set to `educandow_{institution.id}` (Ref: R2)
2. Create a new PostgreSQL database named `educandow_{institution.id}` (Ref: R10)
3. Run `migrations_tenant/` migrations against the new database using `prisma migrate deploy` (Ref: R8) — MUST NOT use `migrations/` or `migrations_master/`
4. Create a default admin user in `educandow_master.users` linked to the new institution (Ref: R10)
5. Return HTTP 201 with the institution ID, `db_name`, and admin user's initial credentials

If **any step** fails, the system MUST roll back all preceding steps (delete the new DB if created, remove the master DB record, delete any created user). This ensures no orphan databases and no orphan user records.

(Previously: step 3 referenced `schema_tenant.prisma` migrations generically — now MUST explicitly point to `migrations_tenant/` directory.)

#### Scenario: Successful institution creation with tenant DB

- GIVEN a ROOT user submits `POST /v1/institutions` with valid data
- WHEN the use case executes all 4 steps
- THEN the institution record exists in `educandow_master.institutions`
- AND a database `educandow_{id}` exists in PostgreSQL
- AND `migrations_tenant/` migrations have been applied to the new database
- AND a default admin user exists in `educandow_master.users` for this institution
- AND the response is HTTP 201 with `{ id, name, db_name, adminUser: { email, temporaryPassword } }`

#### Scenario: Tenant DB creation fails — full rollback

- GIVEN a ROOT user submits `POST /v1/institutions` with valid data
- WHEN the database `educandow_{id}` is created but migrations fail
- THEN the system MUST delete the `educandow_{id}` database
- AND MUST remove the `Institution` record from `educandow_master`
- AND MUST return HTTP 500 with an error indicating tenant DB setup failed

#### Scenario: Master record created but DB creation fails

- GIVEN the institution record is written to `educandow_master` but `CREATE DATABASE` fails
- WHEN the use case catches the error
- THEN the institution record MUST be deleted from `educandow_master`
- AND MUST return HTTP 500

#### Scenario: Non-ROOT user cannot create institution

- GIVEN a user with role ADMIN (not ROOT)
- WHEN they submit `POST /v1/institutions`
- THEN the system MUST reject the request with HTTP 403 Forbidden
- AND no database is created and no record is inserted

### Requirement: Admin User Created on Institution Registration

When a ROOT user creates an institution, after the tenant DB is created and migrations run, the use case MUST create a default admin user record in the master DB associated with the new institution. The admin user credentials MUST be provided in the request or auto-generated and returned in the 201 response (one-time). This implements R10.

#### Scenario: Admin user created as part of institution registration

- GIVEN a ROOT user submits `POST /v1/institutions` with valid data
- WHEN the use case completes all atomic steps
- THEN an admin user record exists in `educandow_master.users` linked to the new institution
- AND the 201 response includes the admin user's initial credentials (one-time display)

#### Scenario: Admin user creation failure triggers rollback

- GIVEN the tenant DB and migrations succeed but admin user creation fails
- WHEN the use case catches the error
- THEN the tenant DB MUST be dropped
- AND the institution record MUST be removed from master DB
- AND the system MUST return HTTP 500

### Requirement: db_name Field

The `db_name` field on `Institution` MUST be automatically generated as `educandow_{id}` where `id` is the institution's UUID. It is NOT set by the client — it is read-only and system-assigned.

#### Scenario: db_name auto-generated on creation

- GIVEN a valid institution creation request
- WHEN the use case creates the institution
- THEN `db_name` is set to `"educandow_{id}"` without any client input
- AND the client cannot override this value

#### Scenario: db_name included in response

- GIVEN a successfully created institution with `id: "abc-123"`
- WHEN the creation response is returned
- THEN `db_name: "educandow_abc-123"` is included in the response

### Requirement: Master DB Isolation

The master database (`educandow_master`) MUST contain only `users`, `institutions`, and `refresh_tokens` tables. No pedagogical or personnel data MUST be stored in the master DB. (Ref: R1)

#### Scenario: No pedagogical tables in master DB

- GIVEN the system is running
- WHEN any request for students, teachers, grades, or similar is processed
- THEN the data is read from the tenant database — the master DB contains zero pedagogical tables

### Requirement: Cue Value Object

The `cue` field MUST be modelled as a `Cue` immutable Value Object at the domain layer. A `Cue` MUST enforce: non-empty string, max 20 characters, no leading/trailing whitespace. DB uniqueness is enforced via the UNIQUE constraint on `institutions.cue`; the domain VO enforces format. A null/absent `cue` is valid — the VO wraps `null` as "not provided".

#### Scenario: Cue VO rejects empty string

- GIVEN `cue: ""` passed to the `Cue` Value Object
- WHEN the VO is constructed
- THEN a domain `ValidationError` is thrown indicating CUE must be non-empty

#### Scenario: Cue VO rejects value exceeding 20 chars

- GIVEN a string of 21 characters passed as `cue`
- WHEN the `Cue` VO is constructed
- THEN a domain `ValidationError` is thrown indicating max 20 characters

#### Scenario: Null cue is valid

- GIVEN `cue: null` passed to the `Cue` VO
- WHEN the VO is constructed
- THEN it succeeds and represents "not provided"

### Requirement: Duplicate CUE Prevention

If the creation request includes a `cue` field, the system MUST validate that no other institution has the same CUE. CUE is UNIQUE across the master DB. The uniqueness check MUST occur before tenant DB creation — no tenant DB is created for a duplicate CUE.

#### Scenario: CUE already exists — creation rejected before tenant DB creation

- GIVEN an existing institution with `cue: "1234567"`
- WHEN a new creation request includes `cue: "1234567"`
- THEN the system MUST reject with HTTP 409 Conflict and a message indicating CUE already exists
- AND no tenant DB is created
- AND no master DB record is inserted

#### Scenario: CUE uniqueness is case-sensitive

- GIVEN an institution with `cue: "ABC123"`
- WHEN a new request has `cue: "abc123"`
- THEN the system MUST allow creation (CUE comparison is case-sensitive unless explicitly normalized)

### Requirement: Schema Separation

The system MUST maintain two separate Prisma schemas: `schema_master.prisma` (containing `Institution`, `User`, `RefreshToken`) and `schema_tenant.prisma` (containing all pedagogical tables). Tenant tables MUST NOT include an `institutionId` column. (Ref: R3)

#### Scenario: Schema_master has no pedagogical models

- GIVEN the Prisma schema files
- WHEN `schema_master.prisma` is inspected
- THEN it contains only `Institution`, `User`, and `RefreshToken` models
- AND no references to `Student`, `Teacher`, `Grade`, `Attendance`, or similar

#### Scenario: Tenant models lack institutionId

- GIVEN `schema_tenant.prisma`
- WHEN tenant models are inspected
- THEN no model contains a field named `institutionId`
- AND no model contains a relation to `Institution`

### Requirement: Separate Migration Directories

The system MUST maintain two separate migration directories: `prisma/migrations_master/` for the master schema (users, institutions, refresh_tokens) and `prisma/migrations_tenant/` for all pedagogical tables. Old mixed migrations MUST be archived to `prisma/migrations_archive/`. All scripts and package.json commands MUST reference the correct directory per schema.

#### Scenario: Fresh master DB deployment from baseline

- GIVEN an empty PostgreSQL database
- WHEN `prisma migrate deploy --schema=prisma/schema_master.prisma` runs pointing to `migrations_master/`
- THEN all master tables are created (users, institutions, refresh_tokens)
- AND no pedagogical table is created in the master DB

#### Scenario: Fresh tenant DB deployment from baseline

- GIVEN an empty PostgreSQL database
- WHEN `prisma migrate deploy --schema=prisma/schema_tenant.prisma` runs pointing to `migrations_tenant/`
- THEN all 42 pedagogical tables are created
- AND no master-only table (users, institutions, refresh_tokens) is created

#### Scenario: Migration command uses wrong directory

- GIVEN `migrations_master/` and `migrations_tenant/` both exist
- WHEN a migration command references the wrong directory for its schema
- THEN Prisma MUST fail with a schema mismatch error
- AND no schema changes are applied

#### Scenario: Old mixed migrations are archived

- GIVEN the legacy `prisma/migrations/` directory exists with mixed migrations
- WHEN the migration separation is applied
- THEN `prisma/migrations/` is moved to `prisma/migrations_archive/`
- AND `prisma migrate deploy` no longer reads from `migrations_archive/`

### Requirement: Baseline Squashed Migrations

Each database schema MUST have a single squashed baseline migration that reproduces the exact current schema in one step. Running `prisma migrate deploy` on a fresh database MUST create ALL tables without needing to replay historical migrations.

#### Scenario: Baseline creates complete master schema

- GIVEN an empty PostgreSQL instance
- WHEN `prisma migrate deploy` runs against `migrations_master/`
- THEN all master tables exist with correct columns and constraints
- AND `_prisma_migrations` shows exactly one applied migration

#### Scenario: Baseline creates complete tenant schema

- GIVEN an empty PostgreSQL instance
- WHEN `prisma migrate deploy` runs against `migrations_tenant/`
- THEN all 42 tenant tables exist with correct columns and constraints
- AND `_prisma_migrations` shows exactly one applied migration

#### Scenario: Existing DB shows "up to date" after resolve

- GIVEN an existing master or tenant DB already at the correct schema state
- WHEN `prisma migrate resolve --applied <baseline>` is run and then `prisma migrate status` is executed
- THEN `prisma migrate status` reports the database is up to date
- AND no new DDL is executed on the existing DB

#### Scenario: Baseline migration is idempotent-safe

- GIVEN a fresh DB where the baseline has already been applied
- WHEN `prisma migrate deploy` is run again
- THEN no error occurs (Prisma marks it already applied)
- AND no duplicate tables are created

### Requirement: Tenant DB Creation Script Uses Correct Directory

The `create-tenant-db.ts` script and `postgres-admin.service.ts` MUST reference `migrations_tenant/` when running migrations for a new tenant database. They MUST NOT reference `migrations_master/` or the archived `migrations/` directory.

#### Scenario: New institution creation applies tenant migrations

- GIVEN a ROOT user submits `POST /v1/institutions` with valid data
- WHEN `create-tenant-db.ts` executes
- THEN `prisma migrate deploy` runs against `migrations_tenant/`
- AND all 42 tenant tables are created in the new `educandow_{id}` database
- AND no master tables are created in the tenant DB

#### Scenario: Tenant creation with missing TENANT_DATABASE_URL env var

- GIVEN `DATABASE_URL_TENANT` is not set in the environment
- WHEN `create-tenant-db.ts` runs
- THEN the script MUST fail with a clear error message indicating the missing env var
- AND no database is created

#### Scenario: Tenant creation rolls back on migration failure

- GIVEN a new database is created but migrations fail (e.g., SQL error)
- WHEN `create-tenant-db.ts` catches the error
- THEN the partially created database MUST be dropped
- AND the error MUST propagate so the institution record is also rolled back

### Requirement: Seed SQL Column Name Fix

`ensureInstitutionLevels()` in `seed.ts` MUST use the correct quoted column name `"institutionId"` in raw SQL queries. The incorrect reference `il.institution_id` MUST NOT appear in any seed or migration file.

#### Scenario: Seed completes without column error

- GIVEN a valid master database with institutions
- WHEN `pnpm --filter api seed` runs
- THEN `ensureInstitutionLevels()` executes without throwing a `column does not exist` error
- AND institution levels are seeded correctly

#### Scenario: Seed is idempotent on re-run

- GIVEN institution levels already exist in the DB
- WHEN `pnpm --filter api seed` is run again
- THEN no duplicate records are created
- AND no error is thrown

### Requirement: Tenant Seed Scripts MUST Be Idempotent

All tenant database seed scripts (`seed-tenant.ts`, `seed.ts` exported functions) MUST use `upsert()` for reference data insertion. Running any tenant seed script multiple times against the same database MUST NOT crash with unique constraint violations.

#### Scenario: Tenant seed runs twice without error

- GIVEN a tenant database with seed already applied
- WHEN `seed-tenant.ts` is executed a second time
- THEN no unique constraint violation occurs
- AND all reference data (attendance statuses, grade scales, grade scale values) remains correct
- AND the script exits with code 0

#### Scenario: seedAttendanceStatuses is idempotent

- GIVEN attendance statuses PRE, AUS, TAR, JUS, RET already exist in the tenant DB
- WHEN `seedAttendanceStatuses()` is called again
- THEN existing records are updated in-place (not duplicated)
- AND no error is thrown

#### Scenario: seedGradeScales is idempotent

- GIVEN grade scales (gs-primaria, gs-inicial, gs-secundaria, gs-terciaria) and their values already exist
- WHEN `seedGradeScales()` is called again
- THEN existing records are updated in-place (not duplicated)
- AND no error is thrown

#### Scenario: Non-idempotent seed file detected

- GIVEN any tenant seed file using `create()` or `createMany()` without `skipDuplicates` for reference data
- WHEN a developer or CI pipeline reviews or runs it
- THEN it SHALL be rejected as non-conformant with this requirement

### Requirement: Listar-Alumnos Query Uses Tenant-Scoped Client

`listar-alumnos.query.ts` MUST NOT include `institutionId` in the `where` clause for tenant DB queries. The tenant Prisma client is already database-scoped; adding `institutionId` references a non-existent column and MUST be removed.

#### Scenario: Listar alumnos returns results without institutionId filter

- GIVEN a tenant DB with students
- WHEN the listar-alumnos query executes
- THEN student records are returned without error
- AND the query does not reference `institutionId` in any WHERE clause

#### Scenario: Query does not crash on valid tenant DB

- GIVEN a properly migrated tenant database
- WHEN `listar-alumnos.query.ts` runs for any institution
- THEN no `column does not exist` runtime error occurs
- AND the result set is correctly scoped to the tenant DB

#### Scenario: Filtering by other valid fields still works

- GIVEN a tenant DB with students in different courses
- WHEN the listar-alumnos query filters by `courseId` or `cycleId`
- THEN only matching students are returned
- AND no SQL error is thrown
