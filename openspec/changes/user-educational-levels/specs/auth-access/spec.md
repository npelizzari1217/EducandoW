# Delta for Auth Access

## ADDED Requirements

### Requirement: JWT Carries levels Array

The JWT payload MUST include a `levels` field typed as `number[]` (array of composite codes, each computed as `level * 10 + modality`). The previous scalar `level: number` field MUST NOT be present in newly issued tokens. The `AuthenticatedUser` domain object MUST expose `levels: number[]` instead of `level: number`.

#### Scenario: Login returns JWT with levels array

- GIVEN a user with `user_levels` [(level=2, modality=0), (level=3, modality=1)]
- WHEN the user authenticates via `POST /v1/auth/login`
- THEN the issued JWT contains `levels: [20, 31]` and does NOT contain a `level` scalar field

#### Scenario: User with no levels gets empty array in JWT

- GIVEN a user with no `user_levels` rows
- WHEN the user authenticates
- THEN the issued JWT contains `levels: []`

#### Scenario: Auth guard extracts levels into AuthenticatedUser

- GIVEN a valid JWT with `levels: [20, 31]`
- WHEN the auth guard processes an incoming request
- THEN `req.user.levels` equals `[20, 31]`

#### Scenario: GET /auth/me response includes levels array

- GIVEN an authenticated user with `user_levels` [(level=1, modality=0)]
- WHEN `GET /v1/auth/me` is called
- THEN the response includes `levels: [10]` and `userLevels: [{ level: 1, modality: 0 }]`
- AND the response does NOT include a scalar `level` field

## MODIFIED Requirements

### Requirement: Role-Based Management Authorization

Every user-management use case (list, create, update, soft-delete) MUST enforce `canManageUser` from the domain layer before operating on a target user. ROOT bypasses all hierarchy checks. The authorization check SHALL use the creator's roles (from the JWT) and the target's roles (from the database), evaluated via `getHighestRoleRank`. Educational level (`levels` array) MUST NOT influence authorization decisions.

(Previously: text referenced singular `level` field; semantics unchanged — educational level does not affect authorization.)

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

## REMOVED Requirements

_(none)_
