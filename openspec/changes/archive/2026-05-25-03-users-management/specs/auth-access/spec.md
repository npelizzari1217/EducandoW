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

All user-management endpoints MUST be protected by `@Roles('ROOT', { module: 'USERS', action: READ|CREATE|UPDATE|DELETE })`. Unauthorized roles SHALL receive HTTP 403 Forbidden.

#### Scenario: Non-authorized role receives 403

- GIVEN a STUDENT role user calling `GET /v1/users`
- WHEN the roles guard evaluates the request
- THEN the system MUST return HTTP 403 Forbidden

#### Scenario: ROOT accesses all actions

- GIVEN a ROOT user
- WHEN any user-management endpoint is called with appropriate hierarchy
- THEN the system processes the request normally — ROOT satisfies all module/action guards