# User Profiles Specification

> **New capability**: user-profiles
> **Change**: user-profiles

## Purpose

Profile-based permission templates that pre-configure module access (booleans) for quick assignment to users. Profiles store permissions as boolean columns (canRead, canCreate, canEdit, canDelete, canPrint) in a junction table with `Module`. On user assignment, booleans are converted to `String[] actions` to create `UserModule` records.

## Requirements

### Requirement: List Profiles

`GET /v1/profiles` MUST return all active (non-deleted) profiles sorted by name. Each profile SHALL include an `assignedModuleCount` field reflecting the number of modules with at least one permission enabled. Soft-deleted profiles SHALL NOT appear.

#### Scenario: List returns active profiles with module count

- GIVEN 3 active profiles exist (2 with permissions assigned, 1 empty)
- WHEN `GET /v1/profiles` is called by an authenticated user with USERS:READ
- THEN the system returns HTTP 200 with `{ data: [...] }` containing all 3 profiles
- AND each profile object includes `assignedModuleCount` (e.g., 0 for the empty profile)

### Requirement: Get Profile

`GET /v1/profiles/:id` MUST return a single profile by ID. The response SHALL include the full permission matrix (all 12 modules with boolean columns, defaulting to `false` for unassigned modules). Non-existent or soft-deleted profiles SHALL return `null`.

#### Scenario: Get existing profile returns full matrix

- GIVEN a profile exists with permissions on STUDENTS(canRead=true)
- WHEN `GET /v1/profiles/:id` is called
- THEN the system returns HTTP 200 with `{ data: { id, name, active, permissions: [{ moduleId, moduleCode, moduleName, canRead: true, canCreate: false, canEdit: false, canDelete: false, canPrint: false }, ...] } }`
- AND the permissions array SHALL contain exactly 12 entries (one per module)

#### Scenario: Get non-existent profile returns null

- GIVEN a non-existent or soft-deleted profile UUID
- WHEN `GET /v1/profiles/:id` is called
- THEN the system returns HTTP 200 with `{ data: null }`

### Requirement: Create Profile

`POST /v1/profiles` MUST create a new profile. Body: `{ name: string (1-100 chars) }`. The created profile SHALL have no permissions assigned (all booleans default to false). The system MUST reject empty or >100 char names.

#### Scenario: Create profile succeeds with valid name

- GIVEN an authenticated user with USERS:CREATE
- WHEN `POST /v1/profiles` with `{ name: "Docente Básico" }`
- THEN the system returns HTTP 201 with `{ data: { id, name, active: true, createdAt } }`
- AND the profile has no permissions assigned

#### Scenario: Create profile rejects empty name

- GIVEN an authenticated user with USERS:CREATE
- WHEN `POST /v1/profiles` with `{ name: "" }`
- THEN the system returns HTTP 400 with validation error

### Requirement: Update Profile

`PATCH /v1/profiles/:id` MUST update a profile's name. Body: `{ name?: string (1-100 chars) }`. Only `name` is mutable. Non-existent profiles SHALL return `{ data: null }`.

#### Scenario: Update profile name succeeds

- GIVEN an existing profile with name "Old Name"
- WHEN `PATCH /v1/profiles/:id` with `{ name: "New Name" }`
- THEN the system returns HTTP 200 with updated name

#### Scenario: Update non-existent profile returns null

- GIVEN a non-existent UUID
- WHEN `PATCH /v1/profiles/:id` with `{ name: "X" }`
- THEN the system returns HTTP 200 with `{ data: null }`

### Requirement: Delete Profile (Soft)

`DELETE /v1/profiles/:id` MUST soft-delete the profile by setting `active = false` and `deletedAt` to current timestamp. Returns HTTP 204. Users previously assigned this profile SHALL retain their `profileId` reference (the profile is marked inactive but the FK remains valid).

#### Scenario: Soft-delete profile succeeds

- GIVEN an existing active profile
- WHEN `DELETE /v1/profiles/:id` is called
- THEN the system returns HTTP 204
- AND the profile's `active` is `false` and `deletedAt` is set

### Requirement: Get Permission Matrix

`GET /v1/profiles/:id/permissions` MUST return all 12 system modules with their boolean permission values for the given profile. Modules with no explicit assignment SHALL return `false` for all 5 booleans. The response SHALL contain exactly 12 rows.

#### Scenario: Get permissions returns all 12 modules

- GIVEN a profile with STUDENTS(canRead=true) assigned
- WHEN `GET /v1/profiles/:id/permissions` is called
- THEN the system returns HTTP 200 with 12 entries
- AND STUDENTS has `canRead: true`, remaining booleans `false`
- AND all other modules have all 5 booleans `false`

### Requirement: Update Permission Matrix

`PUT /v1/profiles/:id/permissions` MUST upsert the complete permission matrix. Body: array of `{ moduleId (UUID), canRead (boolean), canCreate (boolean), canEdit (boolean), canDelete (boolean), canPrint (boolean) }`. The system SHALL delete all existing `ProfileModulePermission` rows for this profile and recreate them from the payload (atomic within a transaction). Modules not present in the payload SHALL have their permissions removed (all booleans set to false). Invalid moduleId SHALL be rejected.

#### Scenario: Full matrix upsert replaces all permissions

- GIVEN a profile with existing permissions
- WHEN `PUT /v1/profiles/:id/permissions` with `[{ moduleId, canRead: true, canCreate: false, canEdit: false, canDelete: false, canPrint: false }, ...]` (subset of modules)
- THEN all previous permission rows are deleted
- AND new rows are created for the provided modules
- AND modules not in the payload have no rows (default to false on GET)

#### Scenario: Upsert with invalid moduleId rejects

- GIVEN a profile with existing permissions
- WHEN `PUT /v1/profiles/:id/permissions` with `[{ moduleId: "invalid-uuid", canRead: true, ... }]`
- THEN the system returns HTTP 400 with validation error

### Requirement: Seed Profiles

The system MUST ship with 3 pre-configured seed profiles:

1. **Administrador**: All modules, all 5 actions (READ, CREATE, UPDATE, DELETE, PRINT)
2. **Docente**: STUDENTS(READ), TEACHERS(READ), GRADES(READ, CREATE, UPDATE), ATTENDANCE(READ, CREATE, UPDATE), REPORTS(READ)
3. **Preceptor**: STUDENTS(READ), ATTENDANCE(READ, CREATE, UPDATE)

These SHALL be created by the seed script and SHALL be available on fresh database setup.

#### Scenario: Seed creates default profiles

- GIVEN a fresh database
- WHEN the seed script runs
- THEN 3 profiles "Administrador", "Docente", "Preceptor" are created
- AND each has the corresponding module permissions assigned
