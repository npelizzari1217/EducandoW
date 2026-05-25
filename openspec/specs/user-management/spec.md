# User Management Specification

## Purpose

CRUD operations for system users with role-hierarchy-based access control. Educational level is a data attribute, not an authorization boundary. Only users with strictly higher role rank (or ROOT) can create, update, or delete other users.

## Requirements

### Requirement: List Users

`GET /v1/users` MUST return users filtered by institution and active status. Non-ROOT users SHALL only see users whose highest role rank is strictly below their own. ROOT MAY see all users. Accepted query parameters: `institutionId` (UUID, optional), `includeInactive` (boolean string, optional, defaults to false).

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

### Requirement: Create User

`POST /v1/users` MUST create a new user. Required fields: `email` (valid email), `password` (min 6 chars), `name` (non-empty). Optional: `institutionId` (UUID), `level` (1–9), `modality` (0–9), `roles` (array of role strings, min 1). The creator's highest role rank MUST be strictly greater than every assigned role's rank. ROOT bypasses this check.

#### Scenario: ADMIN creates a TEACHER

- GIVEN an ADMIN user (rank 60)
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["TEACHER"] }`
- THEN the system creates the user and returns HTTP 201 with the user data including roles

#### Scenario: ADMIN cannot assign ADMIN role

- GIVEN an ADMIN user (rank 60) attempting to create a user with role ADMIN (rank 60)
- WHEN `POST /v1/users` with `{ email, password, name, roles: ["ADMIN"] }`
- THEN the system MUST return an error — creator rank must be strictly higher

#### Scenario: Duplicate email rejected

- GIVEN a user with email `a@b.com` already exists
- WHEN `POST /v1/users` with the same email
- THEN the system MUST return a duplicate email error

#### Scenario: Invalid input returns validation error

- GIVEN a ROOT user
- WHEN `POST /v1/users` with `{ email: "invalid", password: "12" }`
- THEN the system MUST return HTTP 400 with validation errors

### Requirement: Update User

`PATCH /v1/users/:id` MUST allow partial updates. Creator's rank MUST be strictly higher than the target's current highest role rank. If `roles` is provided, creator's rank MUST also be strictly higher than every new role's rank. ROOT bypasses all checks. Non-existent user returns `{ data: null }`.

#### Scenario: ADMIN updates a TEACHER's name

- GIVEN an ADMIN user and a target TEACHER user
- WHEN `PATCH /v1/users/:id` with `{ name: "New Name" }`
- THEN the system updates the name and returns HTTP 200 with updated user data

#### Scenario: ADMIN cannot update another ADMIN

- GIVEN an ADMIN user and a target ADMIN user (same rank)
- WHEN `PATCH /v1/users/:id` is attempted
- THEN the system MUST return an authorization error

#### Scenario: Update non-existent user

- GIVEN any authenticated user
- WHEN `PATCH /v1/users/nonexistent-id` with `{ name: "X" }`
- THEN the system returns HTTP 200 with `{ data: null }`

#### Scenario: Role reassignment respects hierarchy

- GIVEN an ADMIN user (rank 60) updating a TEACHER (rank 20)
- WHEN `PATCH /v1/users/:id` with `{ roles: ["DIRECTOR"] }` (rank 50)
- THEN the system rejects the update — DIRECTOR rank (50) is below ADMIN (60), so ADMIN MAY assign it

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