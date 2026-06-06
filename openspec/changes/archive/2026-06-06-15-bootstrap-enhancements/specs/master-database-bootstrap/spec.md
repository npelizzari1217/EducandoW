# master-database-bootstrap Specification

## Purpose

One-command idempotent setup of the master database: validate environment, create the database if absent, run Prisma migrations, and seed RBAC roles and the ROOT user.

## Requirements

### Requirement: Environment Validation

The script MUST validate that `MASTER_DATABASE_URL` and `ENCRYPTION_KEY` are present in the environment before performing any database operation. `ENCRYPTION_KEY` MUST be exactly 32 bytes. If either condition is not met, the script MUST exit with a non-zero code and a clear error message identifying the missing or invalid variable. The script SHOULD warn when `NODE_ENV` is not `development` but MUST still proceed.

#### Scenario: Both vars present and ENCRYPTION_KEY is 32 bytes

- GIVEN `MASTER_DATABASE_URL` and `ENCRYPTION_KEY` are set
- AND `ENCRYPTION_KEY` is exactly 32 bytes
- WHEN the script starts
- THEN validation passes and execution continues to the next step

#### Scenario: MASTER_DATABASE_URL missing

- GIVEN `MASTER_DATABASE_URL` is not set
- WHEN the script starts
- THEN the script prints an error identifying the missing variable
- AND exits with a non-zero code without touching the database

#### Scenario: ENCRYPTION_KEY is not 32 bytes

- GIVEN `ENCRYPTION_KEY` is set but its byte length differs from 32
- WHEN the script starts
- THEN the script prints an error stating the required length
- AND exits with a non-zero code without touching the database

#### Scenario: NODE_ENV is not development

- GIVEN `NODE_ENV` is set to a value other than `development` (e.g. `production`)
- WHEN the script starts and env validation passes
- THEN the script prints a visible warning showing the current `NODE_ENV`
- AND continues execution without aborting

---

### Requirement: Database Name Extraction

The script MUST extract the database name from the last path segment of `MASTER_DATABASE_URL`.

#### Scenario: Standard connection string

- GIVEN `MASTER_DATABASE_URL` is `postgresql://user:pass@host:5432/educandow_master`
- WHEN the script extracts the database name
- THEN the extracted name is `educandow_master`

---

### Requirement: Maintenance DB Connection

The script MUST connect to the PostgreSQL `postgres` maintenance database using the same host and credentials from `MASTER_DATABASE_URL` (database name replaced with `postgres`) to issue DDL commands.

#### Scenario: Connection succeeds

- GIVEN a valid `MASTER_DATABASE_URL` and a running PostgreSQL instance
- WHEN the script opens the maintenance DB connection
- THEN the connection is established successfully

#### Scenario: Connection fails

- GIVEN PostgreSQL is not reachable
- WHEN the script attempts the maintenance DB connection
- THEN the script prints a clear connection error
- AND exits with a non-zero code

---

### Requirement: Database Creation (Idempotent)

The script MUST attempt to create the target database. If the database already exists, the script MUST treat the "already exists" error as a success and proceed without aborting.

#### Scenario: Database does not exist

- GIVEN the target database does not exist
- WHEN the script runs CREATE DATABASE
- THEN the database is created
- AND the step is reported as success

#### Scenario: Database already exists

- GIVEN the target database already exists
- WHEN the script runs CREATE DATABASE and receives a duplicate-database error
- THEN the script logs "already exists — skipping"
- AND continues to the next step without error

---

### Requirement: Prisma Client Generation

The script MUST run `npx prisma generate --schema=prisma_master/schema.prisma`. If the command fails, the script MUST report the failure and exit with a non-zero code.

#### Scenario: Generate succeeds

- GIVEN `prisma_master/schema.prisma` exists and is valid
- WHEN `prisma generate` runs
- THEN it exits with code 0 and the step is reported as success

#### Scenario: Generate fails

- GIVEN the schema file is missing or invalid
- WHEN `prisma generate` runs and exits with a non-zero code
- THEN the script reports the failure with the command output
- AND exits with a non-zero code

---

### Requirement: Prisma Migrations

The script MUST run `npx prisma migrate deploy --schema=prisma_master/schema.prisma`. The command is naturally idempotent — already-applied migrations are skipped. If the command fails, the script MUST report the failure and exit.

#### Scenario: Migrations applied on first run

- GIVEN migrations have not been applied
- WHEN `prisma migrate deploy` runs
- THEN pending migrations are applied and the step reports success

#### Scenario: No pending migrations (idempotent)

- GIVEN all migrations are already applied
- WHEN `prisma migrate deploy` runs
- THEN it exits with code 0 and the step is reported as success (no-op)

#### Scenario: Migration fails

- GIVEN a migration contains an error
- WHEN `prisma migrate deploy` exits with a non-zero code
- THEN the script reports the failure with the command output
- AND exits with a non-zero code

---

### Requirement: Database Seeding

The script MUST run `npx ts-node prisma/seed.ts`. The seed MUST be idempotent — all upserts must be safe to re-run. If the command fails, the script MUST report the failure and exit.

#### Scenario: Seed succeeds on first run

- GIVEN the master database is empty of RBAC rows
- WHEN the seed runs
- THEN RBAC roles and the ROOT user are created and the step reports success

#### Scenario: Seed is idempotent

- GIVEN RBAC rows already exist
- WHEN the seed runs again
- THEN existing rows are updated in place (upsert) and the step reports success without duplicating data

#### Scenario: Seed fails

- GIVEN the seed script throws an unhandled error
- WHEN `ts-node prisma/seed.ts` exits with a non-zero code
- THEN the script reports the failure with the command output
- AND exits with a non-zero code

---

### Requirement: System Sync SQL Application

After seeding, the script MUST read `scripts/sync-system.sql` and execute its full contents against the master database via a `pg.Pool` connection. The SQL file MUST be executed as a single query. If execution fails, the script MUST print the error and exit with a non-zero code.

#### Scenario: Sync SQL executes successfully

- GIVEN `scripts/sync-system.sql` exists and the master DB has been seeded
- WHEN the script reads and executes the SQL file against the master DB
- THEN all INSERT ON CONFLICT statements complete without error
- AND the step is reported as success

#### Scenario: Sync SQL fails

- GIVEN the SQL file contains a statement that fails (e.g. missing table)
- WHEN `Pool.query()` throws an error
- THEN the script prints the error message
- AND exits with a non-zero code

#### Scenario: Sync SQL is idempotent

- GIVEN the master DB already contains rows from a prior bootstrap run
- WHEN the script executes the sync SQL again
- THEN ON CONFLICT clauses handle duplicates without errors
- AND the step reports success

---

### Requirement: Test Institution Creation

After system sync, the script MUST create a "Test" institution with a fixed UUID (`00000000-0000-0000-0000-000000000001`) and `db_name='educandow_test'` in the master `institutions` table using `INSERT … ON CONFLICT (db_name) DO NOTHING`. The script MUST then create the `educandow_test` database (skipping if it already exists, error code `42P04`). The script MUST run `npx prisma migrate deploy --schema=prisma_tenant/schema.prisma` with `DATABASE_URL` pointing to the tenant DB. Each sub-step MUST print a clear success or skip message.

#### Scenario: First-run institution creation

- GIVEN no institution with `db_name='educandow_test'` exists
- WHEN the script inserts the institution row
- THEN the row is inserted with `id='00000000-0000-0000-0000-000000000001'` and `name='Test'`
- AND the step prints a success message

#### Scenario: Institution already exists (idempotent)

- GIVEN an institution with `db_name='educandow_test'` already exists
- WHEN the script runs the INSERT
- THEN ON CONFLICT DO NOTHING suppresses the insert
- AND the step prints a skip message without error

#### Scenario: Tenant database created on first run

- GIVEN `educandow_test` does not exist
- WHEN the script runs CREATE DATABASE
- THEN the database is created and the step prints success

#### Scenario: Tenant database already exists (idempotent)

- GIVEN `educandow_test` already exists
- WHEN the script runs CREATE DATABASE and receives error code `42P04`
- THEN the script treats it as a skip (not a failure)
- AND prints "already exists — skipping"

#### Scenario: Tenant migrations succeed

- GIVEN `educandow_test` exists and `prisma_tenant/schema.prisma` is valid
- WHEN `prisma migrate deploy` runs with `DATABASE_URL` pointing to `educandow_test`
- THEN all pending tenant migrations are applied and the step reports success

#### Scenario: Tenant migrations fail

- GIVEN the tenant schema file is missing or a migration contains an error
- WHEN `prisma migrate deploy` exits with a non-zero code
- THEN the script reports the failure with the command output
- AND exits with a non-zero code

---

### Requirement: ROOT Credentials Output

After all steps complete successfully, the script MUST print a dedicated credentials block showing the ROOT user's email, password, role, and the local URL.

#### Scenario: Bootstrap completes successfully

- GIVEN all 7 bootstrap steps pass
- WHEN the script prints the final summary
- THEN the output includes a credentials block with:
  - email: `npelizzari@gmail.com`
  - password: `***REMOVED***`
  - role: `ROOT`
  - URL: `http://localhost:5173`

#### Scenario: Bootstrap fails mid-run

- GIVEN the script exits early due to a step failure
- WHEN execution is aborted
- THEN the credentials block is NOT printed (partial success is not success)

---

### Requirement: Step-by-Step Output

The script MUST print a clear status line per step indicating success or failure. The output MUST include the target database name before any destructive-capable operation begins.

#### Scenario: All steps succeed

- GIVEN the script runs and all steps pass
- WHEN execution completes
- THEN each step prints a success indicator
- AND a final success summary is printed

#### Scenario: A step fails

- GIVEN a step exits with a non-zero code
- WHEN the script catches the error
- THEN a failure indicator is printed for that step with the error details
- AND no subsequent steps are executed

---

### Requirement: Bootstrap npm Script

`api/package.json` MUST expose a `"bootstrap"` script entry that invokes `ts-node scripts/bootstrap.ts`.

#### Scenario: Running bootstrap via package manager

- GIVEN `api/package.json` has a `"bootstrap"` script
- WHEN a developer runs `pnpm bootstrap` from `api/`
- THEN the bootstrap script executes

---

### Requirement: .env.example Documentation

`api/.env.example` MUST document `MASTER_DATABASE_URL` and `ENCRYPTION_KEY` with inline comments describing their format and purpose.

#### Scenario: Developer clones the repo

- GIVEN a developer copies `.env.example` to `.env`
- WHEN they read the file
- THEN they find `MASTER_DATABASE_URL` and `ENCRYPTION_KEY` entries with format hints
