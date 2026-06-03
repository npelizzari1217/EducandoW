# Delta for Tenant Database

## ADDED Requirements

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

## MODIFIED Requirements

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
