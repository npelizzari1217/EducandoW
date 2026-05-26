# Delta for Auth Access

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Guard-Based Route Protection

All user-management endpoints MUST be protected by `@Roles('ROOT', { module: 'USERS', action: READ|CREATE|UPDATE|DELETE })`. Unauthorized roles SHALL receive HTTP 403 Forbidden. Student endpoints MUST use `@Roles` with module `STUDENTS` and appropriate actions. TUTOR and STUDENT roles MAY access STUDENTS:READ routes. PATCH /students/:id MUST accept TUTOR and STUDENT roles with field-level validation delegated to the use case layer.
(Previously: Guard protection only covered user-management endpoints with ROOT/ADMIN roles; no STUDENTS module guard for TUTOR/STUDENT)

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
