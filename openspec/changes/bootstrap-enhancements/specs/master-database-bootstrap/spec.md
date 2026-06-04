# Delta for master-database-bootstrap

## ADDED Requirements

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
