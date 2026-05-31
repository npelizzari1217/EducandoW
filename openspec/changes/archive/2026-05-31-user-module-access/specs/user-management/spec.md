# Delta for user-management

## MODIFIED Requirements

### Requirement: Create User

`POST /v1/users` MUST create a new user. Required fields: `email` (valid email), `password` (min 6 chars), `name` (non-empty). Optional: `institutionId` (UUID), `level` (1–9), `modality` (0–9), `roles` (array of role strings, min 1), `moduleAccess` (array of `{ moduleCode: string, actions: string[] }`). The creator's highest role rank MUST be strictly greater than every assigned role's rank. ROOT bypasses this check. If `moduleAccess` is provided, the system MUST persist entries in `user_modules`. Non-ROOT creators SHALL only assign modules they possess; modules outside the creator's scope MUST be silently filtered. `moduleAccess: []` SHALL remove all `user_modules` for the user.

(Previously: no `moduleAccess` parameter; no `user_modules` persistence on create.)

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

### Requirement: Update User

`PATCH /v1/users/:id` MUST allow partial updates. Creator's rank MUST be strictly higher than the target's current highest role rank. If `roles` is provided, creator's rank MUST also be strictly higher than every new role's rank. ROOT bypasses all checks. If `moduleAccess` is provided, the system MUST replace all `user_modules` for that user with the new set (after filtering unauthorized modules for non-ROOT). `moduleAccess: []` SHALL remove all `user_modules`. Absent `moduleAccess` SHALL NOT modify existing `user_modules`. Non-existent user returns `{ data: null }`.

(Previously: no `moduleAccess` parameter; no `user_modules` handling on update.)

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
