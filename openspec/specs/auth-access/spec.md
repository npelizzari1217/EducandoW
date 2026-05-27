# Auth Access Specification

## Purpose

Authorization rules for the auth module. Establishes that role-based access control uses the hierarchy rank system — not educational level — to determine management authority.

## Requirements

### Requirement: Role-Based Management Authorization

Every user-management use case (list, create, update, soft-delete) MUST enforce `canManageUser` from the domain layer before operating on a target user. ROOT bypasses all hierarchy checks. The authorization check SHALL use the creator's roles (from the JWT) and the target's roles (from the database), evaluated via `getHighestRoleRank`. Educational level (`level` field) MUST NOT influence authorization decisions.

#### Scenario: Create enforces hierarchy

- GIVEN a SECRETARIO user (rank 40) attempting to create a user with role PRECEPTOR (rank 30)
- WHEN the create use case executes
- THEN `canManageUser(["SECRETARIO"], ["PRECEPTOR"])` is called and returns `true` — creation proceeds

#### Scenario: Create rejects insufficient hierarchy

- GIVEN a SECRETARIO user (rank 40) attempting to create a user with role DIRECTOR (rank 50)
- WHEN the create use case executes
- THEN the system rejects the operation with an authorization error

#### Scenario: Update checks both current and new roles

- GIVEN an ADMIN user (rank 60) updating a user currently with role TEACHER (rank 20)
- WHEN the update request includes `{ roles: ["SECRETARIO"] }` (rank 40)
- THEN the system checks `canManageUser(["ADMIN"], ["TEACHER"])` for existing roles AND `canManageUser(["ADMIN"], ["SECRETARIO"])` for new roles — both pass, so update proceeds

#### Scenario: Update rejects role escalation beyond creator rank

- GIVEN an ADMIN user (rank 60) updating a SECRETARIO user (rank 40)
- WHEN the update request includes `{ roles: ["ADMIN"] }` (rank 60)
- THEN the system rejects the update — new role rank (60) is not strictly below creator rank (60)

#### Scenario: List filters by hierarchy

- GIVEN a DIRECTOR user (rank 50) listing users
- WHEN the list use case executes
- THEN only users whose highest role rank is strictly below 50 are returned (SECRETARIO, PRECEPTOR, TEACHER, TUTOR, STUDENT)

#### Scenario: Delete enforces hierarchy

- GIVEN a PRECEPTOR user (rank 30) attempting to soft-delete a SECRETARIO user (rank 40)
- WHEN the delete use case executes
- THEN `canManageUser(["PRECEPTOR"], ["SECRETARIO"])` returns `false` — the operation is rejected

#### Scenario: ROOT bypasses all hierarchy checks

- GIVEN a ROOT user performing any user-management operation
- WHEN any use case evaluates `canManageUser`
- THEN the ROOT check short-circuits and the operation proceeds regardless of target roles

### Requirement: Guard-Based Route Protection

All user-management endpoints MUST be protected by `@Roles('ROOT', { module: 'USERS', action: READ|CREATE|UPDATE|DELETE })`. Unauthorized roles SHALL receive HTTP 403 Forbidden. Student endpoints MUST use `@Roles` with module `STUDENTS` and appropriate actions. TUTOR and STUDENT roles MAY access STUDENTS:READ routes. PATCH /students/:id MUST accept TUTOR and STUDENT roles with field-level validation delegated to the use case layer.

#### Scenario: Non-authorized role receives 403

- GIVEN a STUDENT role user calling `GET /v1/users`
- WHEN the roles guard evaluates the request
- THEN the system MUST return HTTP 403 Forbidden

#### Scenario: ROOT accesses all actions

- GIVEN a ROOT user
- WHEN any user-management endpoint is called with appropriate hierarchy
- THEN the system processes the request normally — ROOT satisfies all module/action guards

#### Scenario: TUTOR accesses STUDENTS:READ endpoint

- GIVEN a TUTOR user calling `GET /v1/students/my-children`
- WHEN the roles guard evaluates the request against `@Roles({ module: 'STUDENTS', action: 'READ' })`
- THEN the guard passes and the request is processed

#### Scenario: STUDENT accesses STUDENTS:READ endpoint

- GIVEN a STUDENT user calling `GET /v1/students/me`
- WHEN the roles guard evaluates the request against `@Roles({ module: 'STUDENTS', action: 'READ' })`
- THEN the guard passes and the request is processed

### Requirement: Student and Tutor Module Access

TUTOR role SHALL be granted `STUDENTS:READ` permission. STUDENT role SHALL be granted `STUDENTS:READ` permission. These grants enable TUTOR to access `GET /students/my-children` and STUDENT to access `GET /students/me` and `PATCH /students/:id` (with field-level restrictions enforced at the use case layer). The seed data MUST include these assignments.

#### Scenario: TUTOR has STUDENTS:READ in seed

- GIVEN a fresh database after seed
- WHEN checking role_modules for TUTOR role
- THEN an entry exists for module STUDENTS with action READ

#### Scenario: STUDENT has STUDENTS:READ in seed

- GIVEN a fresh database after seed
- WHEN checking role_modules for STUDENT role
- THEN an entry exists for module STUDENTS with action READ

#### Scenario: TUTOR cannot CREATE/UPDATE/DELETE students

- GIVEN a TUTOR role in the seed
- WHEN checking role_modules for module STUDENTS
- THEN only READ action is present — no CREATE, UPDATE, or DELETE

#### Scenario: Field-level permission enforced at use case layer

- GIVEN a STUDENT with STUDENTS:READ permission attempting PATCH
- WHEN the use case validates the request body against allowed fields for STUDENT role
- THEN blocked fields are rejected with HTTP 403 regardless of STUDENTS:READ grant — module-level READ does not bypass field-level write restrictions
