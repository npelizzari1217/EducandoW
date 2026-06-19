# Auth Access Specification

## Purpose

Authorization rules for the auth module. Establishes that role-based access control uses the hierarchy rank system — not educational level — to determine management authority.

## Requirements

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

### Requirement: JWT Carries levels Array

The JWT payload MUST include a `levels` field typed as `number[]` (array of composite codes, each computed as `level * 10 + modality`). The previous scalar `level: number` field MUST NOT be present in newly issued tokens. The `AuthenticatedUser` domain object MUST expose `levels: number[]` instead of `level: number`. The `levels` array MUST be preserved across token refreshes — `RefreshTokenUseCase` MUST include `levels` and `userLevels` in every newly signed JWT.

(Previously: requirement did not specify behavior for refresh tokens; levels were silently dropped on refresh.)

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

#### Scenario: Refresh token preserves levels array

- GIVEN a valid JWT with `levels: [20, 31]`
- WHEN the refresh token endpoint is called
- THEN the newly issued JWT also contains `levels: [20, 31]`

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

### Requirement: Module-Level Assignment Authorization

When a non-ROOT user creates or updates another user with `moduleAccess`, the system MUST intersect the requested modules with the creator's own modules. Only modules present in the creator's JWT `modules` claim SHALL be assignable. Modules not present in the creator's scope MUST be silently filtered — no error SHALL be returned. ROOT users MAY assign any module without restriction.

#### Scenario: Non-ROOT assigns module they possess

- GIVEN a SECRETARIO with modules [USERS, STUDENTS, ENROLLMENTS] in JWT
- WHEN creating a user with `moduleAccess: [{ moduleCode: "USERS", actions: ["READ"] }]`
- THEN USERS:READ is persisted

#### Scenario: Non-ROOT assigns module they lack

- GIVEN a SECRETARIO with modules [USERS, STUDENTS, ENROLLMENTS] in JWT
- WHEN creating a user with `moduleAccess: [{ moduleCode: "GRADES", actions: ["READ"] }]`
- THEN GRADES is silently filtered; no error returned

#### Scenario: Non-ROOT assigns mixed — only owned modules persist

- GIVEN a DIRECTOR with modules [USERS, STUDENTS]
- WHEN creating a user with `moduleAccess: [{ moduleCode: "USERS", actions: ["READ"] }, { moduleCode: "GRADES", actions: ["READ"] }]`
- THEN only USERS:READ is persisted; GRADES is silently filtered

#### Scenario: ROOT assigns any module without filtering

- GIVEN a ROOT user
- WHEN creating a user with `moduleAccess` containing any module code
- THEN all specified modules are persisted without filtering

### Requirement: Observation Route Protection

Observation endpoints MUST be protected by role rank, not by module/action guard. `POST /v1/student-observations` (studentId in request body) and `GET /v1/students/:studentId/observations` and `GET /v1/courses/:cycleId/observations` (where `:cycleId` references a `CourseCycle` record) SHALL require a minimum role rank of 20 (TEACHER+), enforced by a rank guard at the presentation layer. `DELETE /v1/observations/:id` SHALL require either authorship or minimum rank 60 (ADMIN+), enforced at the use case layer. Callers below the required rank MUST receive HTTP 403 Forbidden.

#### Scenario: TEACHER+ rank guard passes for observation creation

- GIVEN a TEACHER user (rank 20) sending `POST /v1/student-observations` with `studentId` in the body
- WHEN the rank guard evaluates the request
- THEN the guard passes and the request reaches the use case

#### Scenario: PRECEPTOR rank guard passes for observation listing

- GIVEN a PRECEPTOR user (rank 30) sending `GET /v1/students/:studentId/observations`
- WHEN the rank guard evaluates the request
- THEN the guard passes — rank 30 ≥ minimum 20

#### Scenario: Below-minimum rank receives 403 on observation routes

- GIVEN a TUTOR user (rank 10)
- WHEN calling any observation read or write endpoint
- THEN the system returns HTTP 403 Forbidden before reaching the use case

#### Scenario: PSYCHOPEDAGOGICAL type enforced inside use case, not guard

- GIVEN a TEACHER user (rank 20) who passes the rank guard
- WHEN the use case evaluates `type: PSYCHOPEDAGOGICAL` against caller rank < 50
- THEN the use case returns a domain authorization error mapped to HTTP 403
- AND the guard itself does NOT make type-level decisions

### Requirement: TEACHER role — GRADES:UPDATE grant

> Introduced by change: docente-grade-entry (Fase D, Terciario) · 2026-06-19

The `role_modules` entry for the TEACHER role on the GRADES module MUST include `UPDATE` in its `actions` array. The effective grant after this change SHALL be `GRADES: [CREATE, READ, UPDATE]`. This grant is required so TEACHER passes Door 1 (`@Roles({ module: 'GRADES', action: 'UPDATE' })`) on cursada update and confirmar regularidad endpoints. The `UPDATE` grant does NOT give unrestricted update access: `TerciarioAuthorizerService` (Door 3) still enforces per-materia ownership. Primario/Secundario grading (handled by `AssignmentAuthorizer`) is NOT affected.

Implemented via: `api/prisma/seed-rbac.sql` (TEACHER GRADES array updated) + idempotent master migration `api/prisma_master/migrations/20260619110000_teacher_grades_update/migration.sql`. Docentes MUST re-login after the master migration is deployed to receive `GRADES:UPDATE` in their JWT (ADR-7, staleness window).

#### Scenario: Teacher passes Door 1 for GRADES:UPDATE after grant

- GIVEN a user with role TEACHER and GRADES:UPDATE in their resolved role_modules
- WHEN a request hits a cursada endpoint decorated with `@Roles({ module: 'GRADES', action: 'UPDATE' })`
- THEN Door 1 passes (the guard does not reject)

#### Scenario: Teacher still blocked at Door 3 on non-assigned materia

- GIVEN a TEACHER with GRADES:UPDATE (passes Door 1)
- AND the requested inscripcionMateria belongs to a materiaCarreraId NOT assigned to this teacher
- WHEN the use-case invokes TerciarioAuthorizerService.canWriteGrades
- THEN HTTP 403 is returned

#### Scenario: Primario/Secundario grading unaffected

- GIVEN any grading request against a Primario or Secundario endpoint
- WHEN the request is processed
- THEN the existing AssignmentAuthorizer logic is invoked unchanged
- AND the TEACHER GRADES:UPDATE grant does NOT alter Primario/Secundario authorization behavior
