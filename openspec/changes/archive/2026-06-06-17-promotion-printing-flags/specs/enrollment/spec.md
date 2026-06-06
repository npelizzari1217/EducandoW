# Delta for Enrollment (enrollment-status)

## ADDED Requirements

### Requirement: Enrollment entity has printable and promoted flags

The `Enrollment` entity MUST expose `printable` (boolean, default `true`) and `promoted`
(boolean, default `false`) props.
Non-boolean values MUST be rejected with a `ValidationError`.
The entity MUST provide `togglePrintable()` and `togglePromoted()` methods that flip each flag.

#### Scenario: New enrollment defaults

- GIVEN valid enrollment creation props with no explicit flag values
- WHEN `Enrollment.create(props)` is called
- THEN `enrollment.printable` equals `true`
- AND `enrollment.promoted` equals `false`

#### Scenario: Toggle printable flag

- GIVEN an enrollment with `printable = true`
- WHEN `enrollment.togglePrintable()` is called
- THEN `enrollment.printable` equals `false`
- AND calling `togglePrintable()` again returns it to `true`

#### Scenario: Toggle promoted flag

- GIVEN an enrollment with `promoted = false`
- WHEN `enrollment.togglePromoted()` is called
- THEN `enrollment.promoted` equals `true`

#### Scenario: Non-boolean value rejected

- GIVEN a props object where `printable` is the string `"yes"` or `null`
- WHEN `Enrollment.create(props)` is called
- THEN it returns `Result.fail` with a `ValidationError`
- AND the error message identifies the offending field

---

### Requirement: EnrollmentRepository exposes findByCourse query

The `EnrollmentRepository` interface MUST declare `findByCourse(criteria)` where criteria
contains `cycleId`, `level`, `year`, `grade`, and `division`.
It MUST return all enrollments matching ALL supplied criteria.

#### Scenario: Course enrollments found

- GIVEN enrollments exist for cycle `C1`, grade `3`, division `A`
- WHEN `findByCourse({ cycleId: "C1", grade: 3, division: "A", ... })` is called
- THEN it returns all matching enrollments (and only those)

#### Scenario: No enrollments for course

- GIVEN no enrollments exist for the supplied criteria
- WHEN `findByCourse(criteria)` is called
- THEN it returns an empty array (not an error)

---

### Requirement: PATCH /enrollments/:id/flags toggles flags for a single enrollment

The endpoint `PATCH /enrollments/:id/flags` MUST accept a body with optional `printable`
and/or `promoted` booleans and apply each supplied flag to the target enrollment.
It MUST be protected by ADMIN, SECRETARIO, or DIRECTOR role.

#### Scenario: Toggle single flag

- GIVEN a valid enrollment `id` and an authenticated ADMIN user
- WHEN `PATCH /enrollments/:id/flags` is called with `{ "printable": false }`
- THEN the response is `200` with the updated enrollment including `printable: false`

#### Scenario: Enrollment not found

- GIVEN an `id` that does not exist
- WHEN `PATCH /enrollments/:id/flags` is called
- THEN the response is `404`

#### Scenario: Unauthenticated request rejected

- GIVEN no auth token is provided
- WHEN `PATCH /enrollments/:id/flags` is called
- THEN the response is `401`

#### Scenario: Insufficient role rejected

- GIVEN an authenticated user with role STUDENT or TEACHER
- WHEN `PATCH /enrollments/:id/flags` is called
- THEN the response is `403`

---

### Requirement: PATCH /enrollments/course/:cycleId/flags bulk-toggles all students in a course

The endpoint `PATCH /enrollments/course/:cycleId/flags` MUST accept `level`, `year`, `grade`,
`division` as query or body params alongside `printable` and/or `promoted` booleans,
and apply the flags to ALL enrollments matching the course criteria.
It MUST be protected by ADMIN, SECRETARIO, or DIRECTOR role.
It MUST return the count of updated enrollments.

#### Scenario: Bulk toggle printable for a course

- GIVEN enrollments exist for cycle `C1`, grade `3`, division `A`
- AND an authenticated SECRETARIO user
- WHEN `PATCH /enrollments/course/C1/flags` is called with matching criteria and `{ "promoted": true }`
- THEN all matching enrollments have `promoted = true`
- AND the response is `200` with `{ "updated": N }` where N ≥ 1

#### Scenario: No enrollments match course criteria

- GIVEN no enrollments exist for the supplied criteria
- WHEN the bulk endpoint is called
- THEN the response is `200` with `{ "updated": 0 }`

#### Scenario: Unauthenticated request rejected

- GIVEN no auth token is provided
- WHEN `PATCH /enrollments/course/:cycleId/flags` is called
- THEN the response is `401`

#### Scenario: Insufficient role rejected

- GIVEN an authenticated user without ADMIN, SECRETARIO, or DIRECTOR role
- WHEN the bulk endpoint is called
- THEN the response is `403`
