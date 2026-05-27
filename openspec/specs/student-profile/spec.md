# Student Profile Specification

## Purpose

Student self-profile access and field-level permission model for PATCH. STUDENT reads own data; TUTOR reads own children; PATCH enforces per-role editable fields.

## Requirements

### Requirement: Student Self-Profile

`GET /v1/students/me` MUST return the student record whose `userId` matches the authenticated user's ID. Only users with STUDENT or TUTOR role SHALL access this endpoint. If no student exists with that `userId`, the system MUST return HTTP 404.

#### Scenario: STUDENT retrieves own profile

- GIVEN an authenticated user with STUDENT role and `userId` matching student `s1`
- WHEN `GET /v1/students/me` is called
- THEN the system returns HTTP 200 with student `s1` data including `address`, `phone`, `photoUrl`

#### Scenario: No student linked to user

- GIVEN an authenticated STUDENT user with no student record having matching `userId`
- WHEN `GET /v1/students/me` is called
- THEN the system returns HTTP 404

#### Scenario: Unauthenticated request

- GIVEN a request without a valid JWT
- WHEN `GET /v1/students/me` is called
- THEN the system returns HTTP 401

### Requirement: Tutor Children Listing

`GET /v1/students/my-children` MUST return all students linked to the authenticated user via `StudentGuardian` records. Only TUTOR role SHALL access this endpoint. If the tutor has no linked students, the system MUST return HTTP 200 with empty array.

#### Scenario: TUTOR sees their children

- GIVEN an authenticated TUTOR with `userId` linked to students `s1` and `s2` via StudentGuardian
- WHEN `GET /v1/students/my-children` is called
- THEN the system returns HTTP 200 with array containing `s1` and `s2`

#### Scenario: TUTOR with no children

- GIVEN an authenticated TUTOR with no StudentGuardian records
- WHEN `GET /v1/students/my-children` is called
- THEN the system returns HTTP 200 with `{ data: [] }`

#### Scenario: STUDENT cannot access my-children

- GIVEN an authenticated STUDENT user
- WHEN `GET /v1/students/my-children` is called
- THEN the system returns HTTP 403

### Requirement: Field-Level Patch Permissions

`PATCH /v1/students/:id` MUST validate each requested field against the caller's role before updating. STUDENT and TUTOR MAY only edit: `phone`, `address`, `photoUrl`, `email`, `birthDate`, `guardianPhone`. ADMIN, MANAGER, TEACHER, and PRECEPTOR MAY edit all fields. If any blocked field is present in the request body, the system MUST reject the entire request with HTTP 403.

#### Scenario: STUDENT edits allowed field

- GIVEN a STUDENT user with `userId` matching student `s1`
- WHEN `PATCH /v1/students/s1` with `{ phone: "2215551234" }`
- THEN the system updates `phone` and returns HTTP 200

#### Scenario: STUDENT edits blocked field

- GIVEN a STUDENT user with `userId` matching student `s1`
- WHEN `PATCH /v1/students/s1` with `{ firstName: "Nuevo" }`
- THEN the system returns HTTP 403 with a message indicating `firstName` is not editable

#### Scenario: STUDENT patches another student

- GIVEN a STUDENT user with `userId` matching student `s1`
- WHEN `PATCH /v1/students/s2` with `{ phone: "2215551234" }`
- THEN the system returns HTTP 403 — student can only patch themselves

#### Scenario: TUTOR edits child's allowed field

- GIVEN a TUTOR linked to student `s1` via StudentGuardian
- WHEN `PATCH /v1/students/s1` with `{ phone: "2215559999" }`
- THEN the system updates `phone` and returns HTTP 200

#### Scenario: TUTOR edits non-child student

- GIVEN a TUTOR NOT linked to student `s2`
- WHEN `PATCH /v1/students/s2` with `{ phone: "2215559999" }`
- THEN the system returns HTTP 403

#### Scenario: ADMIN edits any field

- GIVEN an ADMIN user
- WHEN `PATCH /v1/students/s1` with `{ firstName: "Nuevo", dni: "12345678" }`
- THEN the system updates all fields and returns HTTP 200

#### Scenario: Mixed allowed and blocked fields

- GIVEN a STUDENT user with `userId` matching student `s1`
- WHEN `PATCH /v1/students/s1` with `{ phone: "2215551234", firstName: "Nuevo" }`
- THEN the system returns HTTP 403 — blocked field `firstName` present, no fields updated
