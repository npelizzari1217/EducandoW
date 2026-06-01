# SDD Delta Spec — 03-user-profiles

> **Change**: 03-user-profiles — User Profiles (Permission Templates)
> **Status**: Ready for DESIGN
> **Date**: 2026-06-01
> **Capabilities affected**:
> - NEW: `user-profiles` → `openspec/changes/03-user-profiles/specs/user-profiles/spec.md`
> - NEW: `profile-assignment` → `openspec/changes/03-user-profiles/specs/profile-assignment/spec.md`
> - MODIFIED: `user-management` → `openspec/changes/03-user-profiles/specs/user-management/spec.md`

---

## Domain: user-profiles (NEW)

> Full spec at `openspec/changes/03-user-profiles/specs/user-profiles/spec.md`

### Requirement: List Profiles

`GET /v1/profiles` MUST return all active profiles sorted by name. Each entry SHALL include `assignedModuleCount` (modules with ≥1 boolean true). Soft-deleted profiles MUST NOT appear. Requires `USERS:READ`.

#### Scenario: Active profiles returned with module count

- GIVEN 3 active profiles (counts: 12, 5, 0)
- WHEN `GET /v1/profiles` is called with valid JWT + USERS:READ
- THEN HTTP 200 with 3 entries each including `assignedModuleCount`

#### Scenario: Deleted profiles excluded

- GIVEN a profile with `active: false`
- WHEN `GET /v1/profiles` is called
- THEN that profile MUST NOT appear

### Requirement: Get Profile with Full Matrix

`GET /v1/profiles/:id` MUST return the full permission matrix (12 entries, one per module; absent = all-false). Non-existent/deleted → `{ data: null }`.

#### Scenario: Returns exactly 12 module entries

- GIVEN a profile with only STUDENTS(canRead=true)
- WHEN `GET /v1/profiles/:id` is called
- THEN `permissions` array has 12 entries; STUDENTS.canRead=true; all others all-false

#### Scenario: Non-existent returns null

- GIVEN a non-existent UUID
- WHEN `GET /v1/profiles/:id` is called
- THEN HTTP 200 with `{ data: null }`

### Requirement: Create Profile

`POST /v1/profiles` MUST create a new profile with name (1–100 chars, non-empty). No permissions assigned at creation. Returns HTTP 201. Requires `USERS:CREATE`.

#### Scenario: Valid name succeeds

- GIVEN authenticated user with USERS:CREATE
- WHEN `POST /v1/profiles` with `{ name: "Docente Básico" }`
- THEN HTTP 201, profile returned with `active: true`, no permissions

#### Scenario: Empty/blank name rejected

- GIVEN authenticated user with USERS:CREATE
- WHEN `POST /v1/profiles` with `{ name: "" }`
- THEN HTTP 400

### Requirement: Update Profile

`PATCH /v1/profiles/:id` MUST update `name` only. Non-existent → `{ data: null }`. Requires `USERS:UPDATE`.

#### Scenario: Name update succeeds

- GIVEN existing profile "Old Name"
- WHEN `PATCH /v1/profiles/:id` with `{ name: "New Name" }`
- THEN HTTP 200 with updated name

### Requirement: Soft-Delete Profile

`DELETE /v1/profiles/:id` MUST set `active=false` + `deletedAt`. Returns HTTP 204. User `profileId` FK retained (no cascade). Requires `USERS:DELETE`.

#### Scenario: Soft-delete sets flags, no cascade

- GIVEN profile P with a user pointing to it
- WHEN `DELETE /v1/profiles/P`
- THEN HTTP 204; profile has `active=false`; user retains `profileId=P`

### Requirement: Get Permission Matrix

`GET /v1/profiles/:id/permissions` MUST return 12 module entries. Absent rows → all-false. Unknown profile → HTTP 404.

#### Scenario: Returns 12 entries with correct values

- GIVEN profile with STUDENTS(canRead=true)
- WHEN `GET /v1/profiles/:id/permissions`
- THEN 12 entries; STUDENTS canRead=true; all others all-false

### Requirement: Update Permission Matrix

`PUT /v1/profiles/:id/permissions` MUST atomically delete + recreate all `ProfileModulePermission` rows. Body: `{ moduleId, canRead, canCreate, canEdit, canDelete, canPrint }[]`. Absent modules default all-false. Invalid UUID → HTTP 400, transaction rolled back. Requires `USERS:UPDATE`.

#### Scenario: Full matrix upsert is atomic

- GIVEN profile with existing permissions
- WHEN `PUT /v1/profiles/:id/permissions` with new 12-entry payload
- THEN all old rows deleted and new rows created in one transaction

#### Scenario: Partial payload — absent modules default false

- GIVEN a profile
- WHEN `PUT` with 3 module entries
- THEN those 3 have rows; remaining 9 have none (GET returns all-false)

#### Scenario: Invalid moduleId rejects + rolls back

- GIVEN a valid profile
- WHEN `PUT` with `moduleId: "not-a-uuid"`
- THEN HTTP 400; no rows modified

### Requirement: Seed Profiles

Seed MUST create "Admin Completo" (all 12 modules × 5 actions) and "Docente Básico" (STUDENTS:READ, GRADES:READ+CREATE+UPDATE, ATTENDANCE:READ+CREATE+UPDATE).

#### Scenario: Seed creates both profiles

- GIVEN a fresh database after seed
- WHEN querying `Profile`
- THEN "Admin Completo" and "Docente Básico" exist with `active=true` and correct permissions

---

## Domain: profile-assignment (NEW)

> Full spec at `openspec/changes/03-user-profiles/specs/profile-assignment/spec.md`

### Requirement: Boolean-to-Actions Conversion

The system MUST convert `ProfileModulePermission` booleans to `String[] actions`: canRead→READ, canCreate→CREATE, canEdit→UPDATE, canDelete→DELETE, canPrint→PRINT. `false` values MUST be omitted.

#### Scenario: All-true → 5 actions

- GIVEN a row with all 5 booleans true
- WHEN conversion runs
- THEN output is `["READ", "CREATE", "UPDATE", "DELETE", "PRINT"]`

#### Scenario: All-false → empty array, no UserModule created

- GIVEN a row with all 5 booleans false
- WHEN conversion runs
- THEN output is `[]`; no UserModule row created for that module

### Requirement: Profile Assignment on User Create

When `profileId` is in `POST /v1/users`, the system MUST load `ProfileModulePermission`, convert to actions, create `UserModule` records, apply `filterModuleAccess()`, and persist `profileId` on the User. If both `profileId` and `moduleAccess` provided, `moduleAccess` takes precedence per-module.

#### Scenario: profileId on create generates user_modules

- GIVEN profile with STUDENTS(canRead=true), GRADES(canRead=true, canCreate=true)
- WHEN `POST /v1/users` with `{ profileId }` by ROOT
- THEN user_modules for STUDENTS:READ, GRADES:READ, GRADES:CREATE created; user.profileId set

#### Scenario: filterModuleAccess applied to profile modules

- GIVEN DIRECTOR with modules [STUDENTS] creating user with profile containing GRADES+STUDENTS
- WHEN `POST /v1/users` with profileId
- THEN GRADES silently filtered; only STUDENTS persisted

#### Scenario: moduleAccess wins per-module over profile

- GIVEN profile with STUDENTS(canRead=true), GRADES(canRead=true, canCreate=true)
- WHEN `POST /v1/users` with `{ profileId, moduleAccess: [{ moduleCode: "STUDENTS", actions: ["READ","CREATE"] }] }` by ROOT
- THEN STUDENTS: manual wins (READ, CREATE); GRADES: profile value (READ, CREATE); profileId persisted

### Requirement: Profile Assignment on User Update

When `profileId` in `PATCH /v1/users/:id`, system SHALL delete all existing UserModule rows and recreate from the new profile. `profileId: null` removes association without touching user_modules. Absent `profileId` leaves association unchanged.

#### Scenario: New profileId replaces user_modules

- GIVEN user with profileId P1 and existing user_modules
- WHEN `PATCH /v1/users/:id` with `{ profileId: "P2" }`
- THEN all old user_modules deleted; new ones from P2 created; user.profileId = P2

#### Scenario: profileId null removes association only

- GIVEN user with profileId set
- WHEN `PATCH /v1/users/:id` with `{ profileId: null }`
- THEN user.profileId = null; user_modules unchanged

#### Scenario: Absent profileId preserves existing

- GIVEN user with profileId P1
- WHEN `PATCH /v1/users/:id` with `{ name: "New" }` (no profileId field)
- THEN user.profileId remains P1

---

## Domain: user-management (MODIFIED)

> Delta spec at `openspec/changes/03-user-profiles/specs/user-management/spec.md`
> References: `openspec/specs/user-management/spec.md` §§ Create User, Update User, Users UI Page

### MODIFIED Requirement: Create User

Add optional `profileId` (UUID) field to `POST /v1/users` DTO. Full requirement text and all existing scenarios retained; three new scenarios added.

(Previously: `profileId` absent from DTO; no profile-driven module generation.)

> All pre-existing scenarios in `openspec/specs/user-management/spec.md` remain valid.

#### Scenario: Create user with profileId generates user_modules *(new)*

- GIVEN profile "Docente" with STUDENTS(canRead=true), GRADES(canRead=true, canCreate=true)
- WHEN `POST /v1/users` with `{ profileId }` by ROOT
- THEN STUDENTS:READ, GRADES:READ, GRADES:CREATE persisted; user.profileId set; filterModuleAccess applied

#### Scenario: profileId + moduleAccess — manual overrides per-module *(new)*

- GIVEN same profile as above
- WHEN `POST /v1/users` with `{ profileId, moduleAccess: [{ moduleCode: "STUDENTS", actions: ["READ","CREATE"] }] }` by ROOT
- THEN STUDENTS uses manual (READ, CREATE); GRADES retains profile (READ, CREATE); profileId persisted

#### Scenario: No profileId → behavior identical to pre-profile *(new)*

- GIVEN ROOT user
- WHEN `POST /v1/users` without `profileId`
- THEN user created with no profileId; no profile-driven modules

### MODIFIED Requirement: Update User

Add optional `profileId` (UUID | null) field to `PATCH /v1/users/:id` DTO. Full requirement text and all existing scenarios retained; three new scenarios added.

(Previously: `profileId` absent from DTO; no profile-driven module replacement on update.)

> All pre-existing scenarios in `openspec/specs/user-management/spec.md` remain valid.

#### Scenario: New profileId replaces user_modules *(new)*

- GIVEN user with profileId P1 and existing user_modules
- WHEN `PATCH /v1/users/:id` with `{ profileId: "P2" }`
- THEN all existing user_modules deleted; new ones from P2; user.profileId = P2

#### Scenario: profileId null removes association without touching modules *(new)*

- GIVEN user with profileId set
- WHEN `PATCH /v1/users/:id` with `{ profileId: null }`
- THEN user.profileId = null; user_modules unchanged

### ADDED Requirement: Users UI Page — Profile Selector

The user create/edit form MUST include a `ProfileSelector` dropdown between the role section and `ModuleAccessGrid`. On selection, fetch `GET /v1/profiles/:id/permissions`, convert booleans to checked cells, pre-fill the grid. User MAY override. A clear action MUST reset both selector and grid (no profileId in payload).

(Previously: no profile selector in user form; modules manually selected only.)

#### Scenario: Profile selection pre-fills grid

- GIVEN user on create/edit form
- WHEN they select "Docente Básico" from ProfileSelector
- THEN `GET /v1/profiles/:id/permissions` fetched; grid populated with boolean matrix

#### Scenario: Manual override retained after pre-fill

- GIVEN grid pre-filled from profile
- WHEN user unchecks GRADES:READ
- THEN grid reflects manual change (pre-fill is not locked)

#### Scenario: Clear resets selector and grid

- GIVEN profile selected and grid pre-filled
- WHEN user clicks "Limpiar"
- THEN selector empty; grid cleared; no profileId in submit payload
