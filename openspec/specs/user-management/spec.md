# User Management Specification

## Purpose

CRUD operations for system users with role-hierarchy-based access control. Educational level is a data attribute, not an authorization boundary. Only users with strictly higher role rank (or ROOT) can create, update, or delete other users.

## Requirements

### Requirement: List Users

`GET /v1/users` MUST return users filtered by institution and active status. Non-ROOT users SHALL only see users whose highest role rank is strictly below their own. ROOT MAY see all users. Accepted query parameters: `institutionId` (UUID, optional), `includeInactive` (boolean string, optional, defaults to false). Each user in the response MUST include a `levels` field (array of composite codes, computed as `level * 10 + modality`) and a `userLevels` field (array of `{ level, modality }` detail objects) derived from `user_levels` rows.

(Previously: response included scalar `level` and `modality` fields directly from the user row; no `user_levels` join.)

#### Scenario: ROOT lists all users

- GIVEN a ROOT user with a valid JWT
- WHEN `GET /v1/users` is called
- THEN the system returns HTTP 200 with `{ data: [...] }` containing all active users ordered by name ascending

#### Scenario: Non-ROOT sees only lower-hierarchy users

- GIVEN an ADMIN user
- WHEN `GET /v1/users` is called
- THEN the response includes only users whose highest rank is below ADMIN rank (60)
- AND users with rank 60 or above MUST NOT appear

#### Scenario: Filter by institution

- GIVEN a ROOT user and multiple institutions exist
- WHEN `GET /v1/users?institutionId={uuid}` is called
- THEN the system returns only users belonging to that institution

#### Scenario: Include inactive users

- GIVEN a ROOT user and some soft-deleted users exist
- WHEN `GET /v1/users?includeInactive=true` is called
- THEN the response includes both active and inactive (soft-deleted) users

#### Scenario: Response includes levels and userLevels

- GIVEN a user with `user_levels` [(level=2, modality=0), (level=3, modality=1)]
- WHEN `GET /v1/users` is called
- THEN each matching user object contains `levels: [20, 31]` and `userLevels: [{ level: 2, modality: 0 }, { level: 3, modality: 1 }]`

#### Scenario: User with no user_levels rows returns empty arrays

- GIVEN a user with no `user_levels` rows
- WHEN `GET /v1/users` is called
- THEN the user object contains `levels: []` and `userLevels: []`

### Requirement: Create User

`POST /v1/users` MUST create a new user. Required fields: `email` (valid email), `password` (min 6 chars), `name` (non-empty). Optional: `institutionId` (UUID), `levels` (array of `{ level: 1–9, modality: 0–9 }`), `roles` (array of role strings, min 1), `moduleAccess` (array of `{ moduleCode: string, actions: string[] }`). The creator's highest role rank MUST be strictly greater than every assigned role's rank. ROOT bypasses this check. If `moduleAccess` is provided, the system MUST persist entries in `user_modules`. Non-ROOT creators SHALL only assign modules they possess; modules outside the creator's scope MUST be silently filtered. `moduleAccess: []` SHALL remove all `user_modules` for the user. The `levels` array, when provided, MUST be persisted as rows in `user_levels` (`userId`, `level`, `modality`). `levels: []` SHALL remove all `user_levels` for the user. Absent `levels` SHALL NOT modify existing `user_levels`.

(Previously: single `level` (1–9) and `modality` (0–9) scalar fields on the user record.)

#### Scenario: ADMIN creates a TEACHER

- GIVEN an ADMIN user (rank 60)
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"] }`
- THEN the system creates the user and returns HTTP 201 with the user data including roles

#### Scenario: ADMIN cannot assign ADMIN role

- GIVEN an ADMIN user (rank 60) attempting to create a user with role ADMIN (rank 60)
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["ADMIN"] }`
- THEN the system MUST return an error — creator rank must be strictly higher

#### Scenario: Create with moduleAccess persists user_modules

- GIVEN a ROOT user
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"], moduleAccess: [{ moduleCode: "STUDENTS", actions: ["READ", "CREATE"] }] }`
- THEN the user is created and `user_modules` entries for STUDENTS:READ and STUDENTS:CREATE are persisted

#### Scenario: Create with moduleAccess filters unauthorized modules

- GIVEN a DIRECTOR with modules [USERS, STUDENTS]
- WHEN creating a user with `moduleAccess: [{ moduleCode: "USERS", actions: ["READ"] }, { moduleCode: "GRADES", actions: ["READ"] }]`
- THEN only USERS:READ is persisted; GRADES is silently filtered

#### Scenario: Duplicate email rejected

- GIVEN a user with email `a@b.com` already exists
- WHEN `POST /v1/users` with the same email
- THEN the system MUST return a duplicate email error

#### Scenario: Invalid input returns validation error

- GIVEN a ROOT user
- WHEN `POST /v1/users` with `{ email: "invalid", password: "12" }`
- THEN the system MUST return HTTP 400 with validation errors

#### Scenario: Create with levels persists user_levels

- GIVEN a ROOT user
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"], levels: [{ level: 2, modality: 0 }, { level: 3, modality: 1 }] }`
- THEN the user is created and `user_levels` rows for (level=2, modality=0) and (level=3, modality=1) are persisted

#### Scenario: Create with empty levels stores no user_levels

- GIVEN a ROOT user
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"], levels: [] }`
- THEN the user is created with no `user_levels` rows

#### Scenario: Create without levels field leaves user_levels untouched

- GIVEN a ROOT user
- WHEN `POST /v1/users` without a `levels` field
- THEN no `user_levels` rows are created or deleted

#### Scenario: Create rejects levels not in institution_levels

- GIVEN a ROOT user creating a user in institution X which has institution_levels [(level=1, modality=0), (level=2, modality=0)]
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"], institutionId: X, levels: [{ level: 2, modality: 0 }, { level: 3, modality: 1 }] }`
- THEN the system MUST reject with HTTP 400 — level (3,1) is not in institution X's levels
- AND no user is created

#### Scenario: Create with valid subset succeeds

- GIVEN a ROOT user creating a user in institution X which has institution_levels [(level=1, modality=0), (level=2, modality=0), (level=3, modality=1)]
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"], institutionId: X, levels: [{ level: 2, modality: 0 }, { level: 3, modality: 1 }] }`
- THEN the user is created successfully with those user_levels

### Requirement: Update User

`PATCH /v1/users/:id` MUST allow partial updates. Creator's rank MUST be strictly higher than the target's current highest role rank. If `roles` is provided, creator's rank MUST also be strictly higher than every new role's rank. ROOT bypasses all checks. If `moduleAccess` is provided, the system MUST replace all `user_modules` for that user with the new set (after filtering unauthorized modules for non-ROOT). `moduleAccess: []` SHALL remove all `user_modules`. Absent `moduleAccess` SHALL NOT modify existing `user_modules`. If `levels` is provided, the system MUST replace all `user_levels` for that user with the new set. `levels: []` SHALL remove all `user_levels`. Absent `levels` SHALL NOT modify existing `user_levels`. Non-existent user returns `{ data: null }`.

(Previously: single `level` and `modality` scalars patched directly on the user row; no `user_levels` table.)

#### Scenario: ADMIN updates a TEACHER's name

- GIVEN an ADMIN user and a target TEACHER user
- WHEN `PATCH /v1/users/:id` with `{ name: "New Name" }`
- THEN the system updates the name and returns HTTP 200 with updated user data

#### Scenario: ADMIN cannot update another ADMIN

- GIVEN an ADMIN user and a target ADMIN user (same rank)
- WHEN `PATCH /v1/users/:id` is attempted
- THEN the system MUST return an authorization error

#### Scenario: Update with moduleAccess replaces user_modules

- GIVEN a user with existing `user_modules` [USERS:READ, STUDENTS:CREATE]
- WHEN `PATCH /v1/users/:id` with `{ moduleAccess: [{ moduleCode: "GRADES", actions: ["READ"] }] }` by ROOT
- THEN the user's `user_modules` are replaced: USERS:READ and STUDENTS:CREATE removed, GRADES:READ added

#### Scenario: Update with empty moduleAccess clears user_modules

- GIVEN a user with existing `user_modules`
- WHEN `PATCH /v1/users/:id` with `{ moduleAccess: [] }`
- THEN all `user_modules` for that user are deleted

#### Scenario: Update without moduleAccess preserves existing

- GIVEN a user with existing `user_modules`
- WHEN `PATCH /v1/users/:id` with `{ name: "New" }` (no `moduleAccess`)
- THEN existing `user_modules` remain unchanged

#### Scenario: Update non-existent user

- GIVEN any authenticated user
- WHEN `PATCH /v1/users/nonexistent-id` with `{ name: "X" }`
- THEN the system returns HTTP 200 with `{ data: null }`

#### Scenario: Role reassignment respects hierarchy

- GIVEN an ADMIN user (rank 60) updating a TEACHER (rank 20)
- WHEN `PATCH /v1/users/:id` with `{ roles: ["DIRECTOR"] }` (rank 50)
- THEN the system accepts the update — DIRECTOR rank (50) is below ADMIN (60)

#### Scenario: Update with levels replaces user_levels

- GIVEN a user with `user_levels` [(level=1, modality=0)]
- WHEN `PATCH /v1/users/:id` with `{ levels: [{ level: 2, modality: 0 }, { level: 3, modality: 1 }] }` by ROOT
- THEN existing user_levels are deleted and new rows (level=2, modality=0) and (level=3, modality=1) are inserted

#### Scenario: Update with empty levels clears user_levels

- GIVEN a user with existing `user_levels`
- WHEN `PATCH /v1/users/:id` with `{ levels: [] }`
- THEN all `user_levels` for that user are deleted

#### Scenario: Update without levels preserves user_levels

- GIVEN a user with existing `user_levels`
- WHEN `PATCH /v1/users/:id` with `{ name: "New" }` (no `levels` field)
- THEN existing `user_levels` remain unchanged

#### Scenario: Update rejects levels not in institution_levels

- GIVEN a user in institution X which has institution_levels [(level=1, modality=0)]
- WHEN `PATCH /v1/users/:id` with `{ levels: [{ level: 2, modality: 0 }] }`
- THEN the system MUST reject with HTTP 400 — level (2,0) is not in institution X's levels

#### Scenario: ROOT bypasses institution level subset validation

- GIVEN a ROOT user
- WHEN `PATCH /v1/users/:id` with `{ levels: [{ level: 9, modality: 9 }] }` regardless of institution levels
- THEN the update succeeds — ROOT is not constrained by institution levels

### Requirement: Soft-Delete User

`DELETE /v1/users/:id` MUST set `active: false` and `deletedAt` to the current timestamp. It SHALL NOT physically remove the record. Creator's rank MUST be strictly higher than the target's highest role rank. ROOT bypasses. Returns HTTP 204 No Content on success.

#### Scenario: ADMIN soft-deletes a TEACHER

- GIVEN an ADMIN user and a TEACHER target
- WHEN `DELETE /v1/users/:id` is called
- THEN the user's `active` becomes `false`, `deletedAt` is set, and HTTP 204 is returned

#### Scenario: ADMIN cannot delete ADMIN or higher

- GIVEN an ADMIN user and an ADMIN (or higher) target
- WHEN `DELETE /v1/users/:id` is called
- THEN the system MUST return an authorization error

#### Scenario: Soft-delete is idempotent

- GIVEN a user already soft-deleted
- WHEN `DELETE /v1/users/:id` is called by an authorized user
- THEN the system SHOULD return HTTP 204

### Requirement: Users UI Page

The system MUST provide a page at `/users` with a table showing: name, email, institution, educational level, role with hierarchy rank, and active status. The page SHALL include an institution UUID filter, an inactive toggle, and create/edit forms with role checkboxes displaying hierarchy ranks. Action buttons MUST be conditional: "Edit" and "Delete" appear only for users the current user can manage; for others, the label "Jerarquía superior" SHALL appear instead. The sidebar MUST show "Usuarios" only for ROOT, ADMIN, and MANAGER roles.

#### Scenario: User with management rights sees action buttons

- GIVEN a DIRECTOR viewing the users table
- WHEN a SECRETARIO row appears
- THEN "Edit" and "Delete" buttons are visible (DIRECTOR rank 50 > SECRETARIO rank 40)

#### Scenario: User without management rights sees hierarchy label

- GIVEN a SECRETARIO viewing the users table
- WHEN a DIRECTOR row appears
- THEN "Jerarquía superior" label is shown instead of action buttons (SECRETARIO rank 40 < DIRECTOR rank 50)