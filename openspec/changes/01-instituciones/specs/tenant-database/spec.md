# Tenant Database Specification

## Purpose

Define how a new institution triggers the creation of its isolated tenant database, including migration execution and failure rollback. (Implements R2, R8, R10)

## Requirements

### Requirement: Automatic Tenant DB Creation

When a ROOT user creates an institution via `POST /v1/institutions`, the system MUST atomically:

1. Insert the `Institution` record into the master DB (`educandow_master`) with `db_name` set to `educandow_{institution.id}` (Ref: R2)
2. Create a new PostgreSQL database named `educandow_{institution.id}` (Ref: R10)
3. Run `schema_tenant.prisma` migrations against the new database (Ref: R8)
4. Return HTTP 201 with the institution ID and `db_name`

If any step fails, the system MUST roll back all preceding steps (delete the new DB if created, remove the master DB record). This ensures no orphan databases.

#### Scenario: Successful institution creation with tenant DB

- GIVEN a ROOT user submits `POST /v1/institutions` with valid data
- WHEN the use case executes
- THEN the institution record exists in `educandow_master.institutions`
- AND a database `educandow_{id}` exists in PostgreSQL
- AND `schema_tenant.prisma` migrations have been applied to the new database
- AND the response is HTTP 201 with `{ id, name, db_name }`

#### Scenario: Tenant DB creation fails — full rollback

- GIVEN a ROOT user submits `POST /v1/institutions` with valid data
- WHEN the database `educandow_{id}` is created but migrations fail
- THEN the system MUST delete the `educandow_{id}` database
- AND MUST remove the `Institution` record from `educandow_master`
- AND MUST return HTTP 500 with an error indicating tenant DB setup failed

#### Scenario: Non-ROOT user cannot create institution

- GIVEN a user with role ADMIN (not ROOT)
- WHEN they submit `POST /v1/institutions`
- THEN the system MUST reject the request with HTTP 403 Forbidden
- AND no database is created and no record is inserted

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

### Requirement: Duplicate CUE Prevention

If the creation request includes a `cue` field, the system MUST validate that no other institution has the same CUE. CUE is UNIQUE across the master DB.

#### Scenario: CUE already exists — creation rejected

- GIVEN an existing institution with `cue: "1234567"`
- WHEN a new creation request includes `cue: "1234567"`
- THEN the system MUST reject with HTTP 409 Conflict and a message indicating CUE already exists
- AND no tenant DB is created

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