# Delta for tenant-database

## Context

Change `01-instituciones` extends the tenant-database spec to: (1) add atomic rollback details for all three failure points (master write, DB create, migrations), (2) add the admin-user creation step as part of `POST /v1/institutions`, and (3) clarify the `Cue` Value Object uniqueness enforcement at the domain layer.

---

## ADDED Requirements

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

---

## MODIFIED Requirements

### Requirement: Automatic Tenant DB Creation

When a ROOT user creates an institution via `POST /v1/institutions`, the system MUST atomically:

1. Insert the `Institution` record into the master DB (`educandow_master`) with `db_name` set to `educandow_{institution.id}` (Ref: R2)
2. Create a new PostgreSQL database named `educandow_{institution.id}` (Ref: R10)
3. Run `schema_tenant.prisma` migrations against the new database (Ref: R8)
4. Create a default admin user in `educandow_master.users` linked to the new institution (Ref: R10)
5. Return HTTP 201 with the institution ID, `db_name`, and admin user's initial credentials

If **any step** fails, the system MUST roll back all preceding steps (delete the new DB if created, remove the master DB record, delete any created user). This ensures no orphan databases and no orphan user records.
(Previously: admin user creation was not part of the atomicity contract — only 3 steps were defined)

#### Scenario: Successful institution creation with tenant DB

- GIVEN a ROOT user submits `POST /v1/institutions` with valid data
- WHEN the use case executes all 4 steps
- THEN the institution record exists in `educandow_master.institutions`
- AND a database `educandow_{id}` exists in PostgreSQL
- AND `schema_tenant.prisma` migrations have been applied to the new database
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

### Requirement: db_name Field

The `db_name` field on `Institution` MUST be automatically generated as `educandow_{id}` where `id` is the institution's UUID. It is NOT set by the client — it is read-only and system-assigned.
(Previously: unchanged — keeping for completeness)

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
(Previously: unchanged — keeping for completeness)

#### Scenario: No pedagogical tables in master DB

- GIVEN the system is running
- WHEN any request for students, teachers, grades, or similar is processed
- THEN the data is read from the tenant database — the master DB contains zero pedagogical tables

### Requirement: Duplicate CUE Prevention

If the creation request includes a `cue` field, the system MUST validate that no other institution has the same CUE. CUE is UNIQUE across the master DB. The uniqueness check MUST occur before tenant DB creation — no tenant DB is created for a duplicate CUE.
(Previously: rollback behavior on CUE conflict was not specified — CUE check may have been post-DB-creation)

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
(Previously: unchanged — keeping for completeness)

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
