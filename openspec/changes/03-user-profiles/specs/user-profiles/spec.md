# User Profiles Specification

> **New capability**: user-profiles
> **Change**: 03-user-profiles

## Purpose

Profile-based permission templates that pre-configure module access (booleans) for quick assignment to users. Profiles store permissions as boolean columns (`canRead`, `canCreate`, `canEdit`, `canDelete`, `canPrint`) in a junction table with `Module`. On user assignment, booleans are converted to `String[] actions` to create `UserModule` records.

## Requirements

### Requirement: List Profiles

`GET /v1/profiles` MUST return all active (non-deleted) profiles sorted by name ascending. Each profile SHALL include an `assignedModuleCount` field: the count of modules with at least one boolean set to `true`. Soft-deleted profiles SHALL NOT appear. Any authenticated user with `USERS:READ` MAY call this endpoint.

#### Scenario: List returns active profiles with module count

- GIVEN 3 active profiles exist — "Admin" (12 modules enabled), "Docente" (5 modules), empty profile (0 modules)
- WHEN `GET /v1/profiles` is called by an authenticated user with USERS:READ
- THEN the system returns HTTP 200 with `{ data: [...] }` containing all 3 profiles sorted by name
- AND each object includes `id`, `name`, `active`, `assignedModuleCount`

#### Scenario: Soft-deleted profiles excluded

- GIVEN a profile with `active: false` and `deletedAt` set
- WHEN `GET /v1/profiles` is called
- THEN the deleted profile MUST NOT appear in the response

#### Scenario: Unauthenticated request rejected

- GIVEN a request without a valid JWT
- WHEN `GET /v1/profiles` is called
- THEN the system MUST return HTTP 401 Unauthorized

### Requirement: Get Profile with Full Matrix

`GET /v1/profiles/:id` MUST return a single profile including the full permission matrix. The `permissions` array SHALL contain exactly one entry per active system module (12 entries), with boolean columns defaulting to `false` for modules not explicitly assigned. Non-existent or soft-deleted profiles SHALL return `{ data: null }`.

#### Scenario: Get existing profile returns full matrix

- GIVEN a profile with STUDENTS(canRead=true, all others false) assigned
- WHEN `GET /v1/profiles/:id` is called
- THEN the system returns HTTP 200 with `{ data: { id, name, active, permissions: [ ...12 entries... ] } }`
- AND the STUDENTS entry has `canRead: true`, remaining booleans `false`
- AND all other 11 module entries have all 5 booleans `false`

#### Scenario: Get non-existent profile returns null

- GIVEN a non-existent or soft-deleted profile UUID
- WHEN `GET /v1/profiles/:id` is called
- THEN the system returns HTTP 200 with `{ data: null }`

### Requirement: Create Profile

`POST /v1/profiles` MUST create a new profile. Required body: `{ name: string }` where name is 1–100 chars, non-empty after trimming. The created profile SHALL have no permissions assigned (all booleans default to `false`). Response SHALL be HTTP 201. Requires `USERS:CREATE` permission.

#### Scenario: Create profile succeeds with valid name

- GIVEN an authenticated user with USERS:CREATE
- WHEN `POST /v1/profiles` with `{ name: "Docente Básico" }`
- THEN the system returns HTTP 201 with `{ data: { id, name: "Docente Básico", active: true, createdAt } }`
- AND no `ProfileModulePermission` rows exist for the new profile

#### Scenario: Create profile rejects empty name

- GIVEN an authenticated user with USERS:CREATE
- WHEN `POST /v1/profiles` with `{ name: "" }` or `{ name: "   " }`
- THEN the system MUST return HTTP 400 with validation error

#### Scenario: Create profile rejects name over 100 chars

- GIVEN an authenticated user with USERS:CREATE
- WHEN `POST /v1/profiles` with `name` length > 100 chars
- THEN the system MUST return HTTP 400 with validation error

### Requirement: Update Profile

`PATCH /v1/profiles/:id` MUST update a profile's `name`. Only `name` is mutable via this endpoint. Non-existent profiles SHALL return `{ data: null }`. Requires `USERS:UPDATE` permission.

#### Scenario: Update profile name succeeds

- GIVEN an existing profile with name "Old Name"
- WHEN `PATCH /v1/profiles/:id` with `{ name: "New Name" }`
- THEN the system returns HTTP 200 with `{ data: { id, name: "New Name", ... } }`

#### Scenario: Update non-existent profile returns null

- GIVEN a non-existent UUID
- WHEN `PATCH /v1/profiles/:id` with `{ name: "X" }`
- THEN the system returns HTTP 200 with `{ data: null }`

### Requirement: Soft-Delete Profile

`DELETE /v1/profiles/:id` MUST soft-delete the profile by setting `active = false` and `deletedAt` to current timestamp. Returns HTTP 204. Users previously assigned this profile SHALL retain their `profileId` FK reference (profile is inactive but FK remains valid — no cascading delete). Requires `USERS:DELETE` permission.

#### Scenario: Soft-delete succeeds

- GIVEN an existing active profile
- WHEN `DELETE /v1/profiles/:id` is called by an authorized user
- THEN the system returns HTTP 204
- AND the profile row has `active = false` and `deletedAt` set

#### Scenario: Users retain profileId after profile soft-delete

- GIVEN a user with `profileId` pointing to profile P
- WHEN `DELETE /v1/profiles/P` is called
- THEN the user's `profileId` column retains the value (no cascade)
- AND the profile P has `active = false`

### Requirement: Get Permission Matrix

`GET /v1/profiles/:id/permissions` MUST return all active system modules with their boolean permission values for the given profile. Modules without an explicit `ProfileModulePermission` row SHALL return `false` for all 5 booleans. The response SHALL contain exactly 12 entries regardless of how many rows exist in `ProfileModulePermission`.

#### Scenario: Get permissions returns all 12 modules

- GIVEN a profile with STUDENTS(canRead=true) assigned and no other permissions
- WHEN `GET /v1/profiles/:id/permissions` is called
- THEN the system returns HTTP 200 with exactly 12 entries
- AND STUDENTS entry has `canRead: true`, other 4 booleans `false`
- AND all remaining 11 modules have all 5 booleans `false`

#### Scenario: Get permissions for unknown profile returns 404

- GIVEN a non-existent profile UUID
- WHEN `GET /v1/profiles/:id/permissions` is called
- THEN the system MUST return HTTP 404

### Requirement: Update Permission Matrix

`PUT /v1/profiles/:id/permissions` MUST atomically replace the complete permission matrix for the profile. Body: array of `{ moduleId: UUID, canRead: boolean, canCreate: boolean, canEdit: boolean, canDelete: boolean, canPrint: boolean }`. The operation SHALL delete all existing `ProfileModulePermission` rows for this profile and recreate from the payload within a single transaction. Modules absent from the payload default to all-false on subsequent GET. Invalid `moduleId` values MUST be rejected. Requires `USERS:UPDATE` permission.

#### Scenario: Full matrix upsert replaces all permissions atomically

- GIVEN a profile with existing permissions on STUDENTS and GRADES
- WHEN `PUT /v1/profiles/:id/permissions` with 12 module entries (TEACHERS canCreate=true, others all-false)
- THEN all previous rows are deleted and new rows created atomically
- AND `GET /v1/profiles/:id/permissions` returns TEACHERS canCreate=true, all others false

#### Scenario: Partial payload — absent modules default false

- GIVEN a profile with permissions
- WHEN `PUT /v1/profiles/:id/permissions` with only 3 module entries
- THEN only those 3 modules have rows; the other 9 have no rows (return false on GET)

#### Scenario: Invalid moduleId rejected

- GIVEN a valid profile
- WHEN `PUT /v1/profiles/:id/permissions` with `[{ moduleId: "not-a-uuid", canRead: true, ... }]`
- THEN the system MUST return HTTP 400 with validation error
- AND no rows are modified (transaction rolled back)

### Requirement: Seed Profiles

The seed script MUST create 2 pre-configured profiles on fresh database setup:

| Profile | Permissions |
|---------|-------------|
| Admin Completo | All 12 modules × all 5 actions |
| Docente Básico | STUDENTS(READ), GRADES(READ, CREATE, UPDATE), ATTENDANCE(READ, CREATE, UPDATE) |

#### Scenario: Seed creates default profiles

- GIVEN a fresh database after running `seed.ts`
- WHEN querying `Profile` table
- THEN profiles "Admin Completo" and "Docente Básico" exist with `active = true`
- AND their `ProfileModulePermission` rows match the matrix above
