# Student Guardian Specification

## Purpose

N:M relationship between Student and User (tutor). Manages tutor assignments, migration of legacy guardianName/guardianPhone, and the StudentGuardian entity.

## Requirements

### Requirement: StudentGuardian Entity

The system SHALL define a `StudentGuardian` entity linking a Student to a User (tutor). Each record MUST contain `studentId`, `userId`, `relationship` (e.g., "mother", "father", "legal_guardian"), `isFinancialResponsible` (Boolean, default `false`), and `isAuthorizedToPickUp` (Boolean, default `false`). The composite `(studentId, userId)` MUST be unique. `userId` references the master User table without a database FK (cross-DB constraint validated in the application layer).

#### Scenario: Defaults on create

- GIVEN student `s1` and user `u-tutor` exist
- WHEN a StudentGuardian record is created with `{ studentId: "s1", userId: "u-tutor", relationship: "mother" }`
- THEN the record is persisted; both booleans default to `false`; HTTP 201

#### Scenario: Explicit flags persisted

- GIVEN student `s1` and user `u-tutor` exist
- WHEN a StudentGuardian record is created with `{ studentId: "s1", userId: "u-tutor", relationship: "father", isFinancialResponsible: true, isAuthorizedToPickUp: false }`
- THEN those boolean values are stored exactly

#### Scenario: Duplicate guardian link rejected

- GIVEN a StudentGuardian record already exists for `(studentId: "s1", userId: "u-tutor")`
- WHEN creating another with the same pair
- THEN the system returns a conflict error (HTTP 409)

#### Scenario: Cross-DB userId validation

- GIVEN a StudentGuardian with `userId: "nonexistent"`
- WHEN the application layer validates before persist
- THEN the system MUST log a warning and proceed — no FK enforcement across databases

### Requirement: Assign Guardian to Student

`POST /v1/students/:id/guardians` MUST create a StudentGuardian link. Only ROOT and ADMIN roles MAY assign guardians. The request body SHALL contain `userId` (required), `relationship` (required, one of: "mother", "father", "legal_guardian", "other"), `isFinancialResponsible` (optional, default `false`), and `isAuthorizedToPickUp` (optional, default `false`).

#### Scenario: ADMIN assigns guardian with defaults

- GIVEN an ADMIN user and student `s1` exists
- WHEN `POST /v1/students/s1/guardians` with `{ userId: "u-tutor", relationship: "father" }`
- THEN the StudentGuardian record is created; booleans default to `false`; HTTP 201 returned

#### Scenario: ADMIN assigns guardian with explicit flags

- GIVEN an ADMIN user and student `s1` exists
- WHEN `POST /v1/students/s1/guardians` with `{ userId: "u-tutor", relationship: "mother", isFinancialResponsible: true, isAuthorizedToPickUp: true }`
- THEN the StudentGuardian record is created with those boolean values; HTTP 201

#### Scenario: TUTOR cannot assign guardians

- GIVEN a TUTOR user
- WHEN `POST /v1/students/s1/guardians` with `{ userId: "u-tutor2", relationship: "mother" }`
- THEN the system returns HTTP 403

#### Scenario: Missing required fields

- GIVEN an ADMIN user
- WHEN `POST /v1/students/s1/guardians` with `{ userId: "u-tutor" }` (missing relationship)
- THEN the system returns HTTP 400 with validation error

### Requirement: Remove Guardian from Student

`DELETE /v1/students/:id/guardians/:guardianId` MUST remove the StudentGuardian link. Only ROOT and ADMIN roles MAY remove guardians.

#### Scenario: ADMIN removes guardian

- GIVEN an ADMIN user and StudentGuardian `sg1` exists for student `s1`
- WHEN `DELETE /v1/students/s1/guardians/sg1` is called
- THEN the record is deleted and HTTP 204 returned

#### Scenario: TUTOR cannot remove guardians

- GIVEN a TUTOR user
- WHEN `DELETE /v1/students/s1/guardians/sg1` is called
- THEN the system returns HTTP 403

#### Scenario: Guardian not found

- GIVEN an ADMIN user and no StudentGuardian with `id: "sg-missing"`
- WHEN `DELETE /v1/students/s1/guardians/sg-missing` is called
- THEN the system returns HTTP 404

### Requirement: Legacy Guardian Data Migration

The system SHALL provide a one-time migration that reads existing `guardianName` and `guardianPhone` from Student records and creates StudentGuardian entries where a matching User exists by phone or name. Students without a matching User MUST retain `guardianName`/`guardianPhone` (fields are NOT dropped). The migration MUST be idempotent — running it twice produces the same result.

#### Scenario: Matching user found by phone

- GIVEN a Student with `guardianPhone: "2215551234"` and a User with matching phone
- WHEN the migration runs
- THEN a StudentGuardian record is created linking Student to User with `relationship: "other"`

#### Scenario: No matching user

- GIVEN a Student with `guardianName: "María López"` and no User matching by name or phone
- WHEN the migration runs
- THEN no StudentGuardian is created; `guardianName`/`guardianPhone` are preserved

#### Scenario: Idempotent migration

- GIVEN a StudentGuardian already exists for a Student
- WHEN the migration runs again
- THEN no duplicate StudentGuardian is created

### Requirement: Retrieve Guardians for Student

`GET /v1/students/:id/guardians` MUST return an array of `{ id, userId, relationship, isFinancialResponsible, isAuthorizedToPickUp }` per record. JWT required; ADMIN, ROOT, and TUTOR (own students) MAY access.

#### Scenario: Returns list

- GIVEN a student with two guardian records and a valid token
- WHEN `GET /v1/students/s1/guardians` is called
- THEN HTTP 200 is returned with both records in the response body

#### Scenario: Empty list

- GIVEN a student with no guardian records
- WHEN `GET /v1/students/s1/guardians` is called
- THEN HTTP 200 is returned with an empty array `[]`
