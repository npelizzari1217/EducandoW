# Student Guardian Specification

> Last updated: responsables-y-tutores (2026-06-29). Archive: `openspec/changes/archive/2026-06-29-responsables-y-tutores/`.
> **RFC 2119**: MUST / SHALL / SHOULD / MAY as defined in RFC 2119.

## Purpose

N:M relationship between Student and guardian/tutor. Manages portal-link assignments, contact-only study tutors, migration of legacy guardianName/guardianPhone, and the StudentGuardian entity.

Extended in **responsables-y-tutores** (2026-06-29): `userId` is now optional (contact-only study tutors require no portal account), `relationship` is free text ≤15 chars (enum removed), and new fields (`fullName`, `mobile`, `email`, `active`, `updatedAt`) were added. Two new use cases introduced: `CreateStudyTutorUseCase`, `UpdateStudyTutorUseCase`. `AssignGuardianUseCase` preserved for portal links.

---

## Requirements

### Requirement: StudentGuardian Entity

The system SHALL define a `StudentGuardian` entity covering two roles: (a) a **portal link** — connecting a student to a User with family portal access; (b) a **contact-only study tutor** — no portal account. Each record MUST contain:

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | String (UUID) | auto | Primary key |
| `studentId` | String | — | FK to Student |
| `userId` | String? (optional) | null | When present: portal account. When null: contact-only tutor. |
| `relationship` | String VarChar(15) | — | Free text; non-empty; max 15 characters. Former enum values (mother/father/legal_guardian/other) remain valid strings. |
| `fullName` | String? (schema) | — | Required by `CreateStudyTutorUseCase`; nullable in DB to preserve portal rows |
| `mobile` | String? (schema) | — | Validated as `Mobile` VO; required by `CreateStudyTutorUseCase` |
| `email` | String? | — | Validated as `Email` VO when present |
| `isFinancialResponsible` | Boolean | false | |
| `isAuthorizedToPickUp` | Boolean | false | |
| `active` | Boolean | true | Deactivatable |
| `createdAt` | DateTime | now | |
| `updatedAt` | DateTime | @updatedAt | Auto-updated on every mutation |

"Has portal access" MUST be inferred exclusively from `userId != null`. No discriminator field is introduced.

The composite `(studentId, userId)` MUST be unique at DB level. Postgres treats NULLs as distinct, so multiple contact-only tutor rows per student do NOT violate this constraint.

`StudentGuardian.create()` MUST return `Result<StudentGuardian, ValidationError>` (not throw). The entity validates `relationship` length (1–15 chars) and applies field defaults. `fullName`/`mobile` required-ness is enforced in the application layer, not the entity.

#### Scenario: Defaults on create (portal link)

- GIVEN student `s1` and user `u-tutor` exist
- WHEN a StudentGuardian portal record is created with `{ studentId: "s1", userId: "u-tutor", relationship: "mother" }`
- THEN the record is persisted; `active = true`; `isFinancialResponsible = false`; `isAuthorizedToPickUp = false`; HTTP 201

#### Scenario: Explicit flags persisted

- GIVEN student `s1` and user `u-tutor` exist
- WHEN a StudentGuardian record is created with `{ studentId: "s1", userId: "u-tutor", relationship: "father", isFinancialResponsible: true, isAuthorizedToPickUp: false }`
- THEN those boolean values are stored exactly

#### Scenario: Duplicate portal guardian rejected

- GIVEN a StudentGuardian record already exists for `(studentId: "s1", userId: "u-tutor")`
- WHEN creating another with the same pair
- THEN the system MUST return HTTP 409 with code `GUARDIAN_ALREADY_ASSIGNED`

#### Scenario: Cross-DB userId validation

- GIVEN a StudentGuardian with `userId: "nonexistent"`
- WHEN the application layer validates before persist
- THEN the system MUST log a warning and proceed — no FK enforcement across databases

---

### Requirement: Extended Fields on StudentGuardian (REQ-RYT-02)

`StudentGuardian` MUST include `fullName`, `mobile`, `email`, `active`, and `updatedAt` as described in the entity table above.

#### Scenario RYT-02-A: New fields persist when creating study tutor

- GIVEN an ADMIN user and student `s1`
- WHEN `CreateStudyTutorUseCase` executes with `{ studentId: "s1", fullName: "Ana García", mobile: "+5492215551234", relationship: "abuela" }`
- THEN the system persists a `StudentGuardian` with `active = true`, `updatedAt` set to current time, `userId = null`
- AND returns a success Result with the created record

#### Scenario RYT-02-B: updatedAt refreshed on mutation

- GIVEN a `StudentGuardian` record `sg1` with `updatedAt = T0`
- WHEN `UpdateStudyTutorUseCase` executes with any valid field change
- THEN `sg1.updatedAt` MUST be updated to a timestamp after `T0`

---

### Requirement: userId Optional — Portal Inference (REQ-RYT-03)

`StudentGuardian.userId` MUST be nullable. "Has portal access" MUST be inferred exclusively from `userId != null`. No discriminator field or separate model is introduced.

#### Scenario RYT-03-A: Study tutor without account — userId null

- GIVEN a `StudentGuardian` created via `CreateStudyTutorUseCase` with no `userId`
- WHEN the entity is loaded
- THEN `guardian.userId` is `null`
- AND the system MUST treat this record as a contact-only tutor (no portal access)

#### Scenario RYT-03-B: Guardian with portal — userId present

- GIVEN a `StudentGuardian` created via `AssignGuardianUseCase` with `userId = "u-tutor"`
- WHEN the entity is loaded
- THEN `guardian.userId` is `"u-tutor"`
- AND the system MUST treat this record as having portal access

---

### Requirement: relationship — Free Text ≤15 Characters (REQ-RYT-04)

`StudentGuardian.relationship` MUST be stored as `String @db.VarChar(15)`. The enum `GuardianRelationship` is removed. The application layer MUST validate that the value is non-empty and at most 15 characters. Values from the old enum (`mother`, `father`, `legal_guardian`, `other`) are all ≤15 characters and remain valid as strings.

#### Scenario RYT-04-A: Valid value accepted

- GIVEN an ADMIN user
- WHEN `CreateStudyTutorUseCase` executes with `{ relationship: "abuela" }`
- THEN the system persists `relationship = "abuela"` and returns success

#### Scenario RYT-04-B: Value too long rejected

- GIVEN an ADMIN user
- WHEN `CreateStudyTutorUseCase` executes with `{ relationship: "tutora_externa_x" }` (16 chars)
- THEN the system MUST return a `Result.err` with a validation error; no record is persisted

#### Scenario RYT-04-C: Empty value rejected

- GIVEN an ADMIN user
- WHEN `CreateStudyTutorUseCase` executes with `{ relationship: "" }`
- THEN the system MUST return a `Result.err` with a validation error

---

### Requirement: CreateStudyTutorUseCase (REQ-RYT-05)

`CreateStudyTutorUseCase.execute()` MUST create a `StudentGuardian` without a `userId`. The application layer MUST enforce `fullName`, `mobile`, and `relationship` as required inputs. `relationship` MUST be provided and non-empty on creation — there is no default value. Omitting or providing a whitespace-only relationship MUST return `Result.err` with code `RELATIONSHIP_REQUIRED`. `isFinancialResponsible` and `isAuthorizedToPickUp` default to `false`. The use case MUST return `Result<StudentGuardian, DomainError>`.

#### Scenario RYT-05-A: Successful creation of study tutor

- GIVEN an ADMIN user and student `s1` exists
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Lucía Rodríguez", mobile: "+5492215559999", relationship: "tutor" })`
- THEN a `StudentGuardian` is persisted with `userId = null`, `active = true`, `isFinancialResponsible = false`, `isAuthorizedToPickUp = false`
- AND `Result.isOk()` is `true`

#### Scenario RYT-05-G: relationship absent — rejected

- GIVEN an ADMIN user and student `s1` exists
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Lucía Rodríguez", mobile: "+5492215559999" })` (no relationship)
- THEN the use case MUST return `Result.err` with code `RELATIONSHIP_REQUIRED`
- AND no record is persisted

#### Scenario RYT-05-B: fullName absent — rejected

- GIVEN an ADMIN user and student `s1` exists
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", mobile: "+5492215559999", relationship: "tutor" })`
- THEN the use case MUST return `Result.err` with code `FULL_NAME_REQUIRED`
- AND no record is persisted

#### Scenario RYT-05-C: mobile absent — rejected

- GIVEN an ADMIN user and student `s1` exists
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Lucía Rodríguez", relationship: "tutor" })`
- THEN the use case MUST return `Result.err` with code `MOBILE_REQUIRED`
- AND no record is persisted

#### Scenario RYT-05-D: mobile with invalid format — rejected

- GIVEN an ADMIN user and student `s1` exists
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Lucía Rodríguez", mobile: "123", relationship: "tutor" })`
- THEN `Mobile` VO construction MUST return an error
- AND the use case MUST propagate it as `Result.err`

#### Scenario RYT-05-E: optional valid email included

- GIVEN an ADMIN user and student `s1` exists
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Lucía Rodríguez", mobile: "+5492215559999", relationship: "tutor", email: "lucia@example.com" })`
- THEN the system persists `email = "lucia@example.com"` and returns success

#### Scenario RYT-05-F: optional invalid email — rejected

- GIVEN an ADMIN user
- WHEN `CreateStudyTutorUseCase.execute({ ..., email: "not-an-email" })`
- THEN `Email` VO construction MUST return an error
- AND the use case MUST return `Result.err`; no record is persisted

---

### Requirement: UpdateStudyTutorUseCase (REQ-RYT-06)

`UpdateStudyTutorUseCase.execute()` MUST allow updating `fullName`, `mobile`, `email`, `active`, and `relationship` on an existing `StudentGuardian`. The use case MUST NOT allow changing `userId`, `studentId`, `isFinancialResponsible`, or `isAuthorizedToPickUp`. The use case MUST return `Result<StudentGuardian, DomainError>`. `updatedAt` MUST be refreshed by the DB (`@updatedAt`).

#### Scenario RYT-06-A: Update fullName and mobile

- GIVEN a `StudentGuardian` `sg1` with `fullName = "Ana García"` and `mobile = "+5492215551234"`
- WHEN `UpdateStudyTutorUseCase.execute({ id: "sg1", fullName: "Ana G. López", mobile: "+5492215554321" })`
- THEN `sg1.fullName = "Ana G. López"` and `sg1.mobile = "+5492215554321"` are persisted
- AND `Result.isOk()` is `true`

#### Scenario RYT-06-B: Toggle active to false

- GIVEN a `StudentGuardian` `sg1` with `active = true`
- WHEN `UpdateStudyTutorUseCase.execute({ id: "sg1", active: false })`
- THEN `sg1.active = false` is persisted and returned in the Result

#### Scenario RYT-06-C: Tutor not found

- GIVEN no `StudentGuardian` exists with `id: "sg-missing"`
- WHEN `UpdateStudyTutorUseCase.execute({ id: "sg-missing", fullName: "..." })`
- THEN the use case MUST return `Result.err` with code `GUARDIAN_NOT_FOUND` (HTTP 404)

#### Scenario RYT-06-D: null email accepted (clear email)

- GIVEN a `StudentGuardian` `sg1` with `email = "old@example.com"`
- WHEN `UpdateStudyTutorUseCase.execute({ id: "sg1", email: null })`
- THEN `sg1.email` is set to `null` and the change is persisted

---

### Requirement: Assign Guardian to Student — Portal Links (REQ-RYT-07)

`POST /v1/students/:id/guardians` dispatches based on `userId` presence in the body:
- **`userId` present** → `AssignGuardianUseCase` (portal link path). `userId` MUST be required; calling with `userId = null` or `undefined` MUST return `Result.err` with code `USER_ID_REQUIRED`.
- **`userId` absent** → `CreateStudyTutorUseCase` (study tutor path).

Only ROOT and ADMIN roles MAY call this endpoint. `relationship` MUST always be provided and non-empty. When both `userId` and `fullName` are present in the body, the portal path (`userId`) takes precedence.

#### Scenario RYT-07-A: Portal assignment with userId

- GIVEN an ADMIN user, student `s1`, and user `u-tutor` exist
- WHEN `AssignGuardianUseCase.execute({ studentId: "s1", userId: "u-tutor", relationship: "father" })`
- THEN a `StudentGuardian` is created with `userId = "u-tutor"`
- AND `Result.isOk()` is `true`

#### Scenario RYT-07-B: userId absent — rejected by AssignGuardianUseCase

- GIVEN an ADMIN user
- WHEN `AssignGuardianUseCase.execute({ studentId: "s1", relationship: "mother" })` (no userId)
- THEN the use case MUST return `Result.err` with code `USER_ID_REQUIRED`

#### Scenario: ADMIN assigns guardian (via portal path)

- GIVEN an ADMIN user and student `s1` exists
- WHEN `POST /v1/students/s1/guardians` with `{ userId: "u-tutor", relationship: "father" }`
- THEN the StudentGuardian portal record is created; HTTP 201 returned

#### Scenario: TUTOR cannot assign guardians

- GIVEN a TUTOR user
- WHEN `POST /v1/students/s1/guardians` with any body
- THEN the system returns HTTP 403

#### Scenario: Missing relationship

- GIVEN an ADMIN user
- WHEN `POST /v1/students/s1/guardians` with `{ userId: "u-tutor" }` (missing relationship)
- THEN the system returns HTTP 400 with validation error

---

### Requirement: Uniqueness — DB + Application Layer (REQ-RYT-08)

The DB MUST enforce `@@unique([studentId, userId])`. In Postgres, two rows with `userId = NULL` for the same `studentId` are NOT considered duplicates at DB level (NULLs are distinct). The application layer MUST therefore enforce an additional uniqueness check on `(studentId, fullName)` to prevent accidental duplicate study tutors. This check MAY be bypassed by passing `allowDuplicate: true` (for legitimate homonyms).

#### Scenario RYT-08-A: Duplicate portal (same userId) rejected by DB

- GIVEN a `StudentGuardian` already exists for `(studentId: "s1", userId: "u-tutor")`
- WHEN `AssignGuardianUseCase.execute({ studentId: "s1", userId: "u-tutor", relationship: "father" })`
- THEN the system MUST return `Result.err` with code `GUARDIAN_ALREADY_ASSIGNED` (HTTP 409)

#### Scenario RYT-08-B: Duplicate tutor (same fullName) blocked at application layer

- GIVEN a `StudentGuardian` exists with `(studentId: "s1", fullName: "Ana García", userId: null)`
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Ana García", mobile: "...", relationship: "tutor" })` without `allowDuplicate`
- THEN the use case MUST return `Result.err` with code `TUTOR_DUPLICATE_NAME` (HTTP 409)

#### Scenario RYT-08-C: Legitimate homonyms with override

- GIVEN a `StudentGuardian` exists with `(studentId: "s1", fullName: "Ana García", userId: null)`
- WHEN `CreateStudyTutorUseCase.execute({ studentId: "s1", fullName: "Ana García", mobile: "...", relationship: "tutor", allowDuplicate: true })`
- THEN the system MUST persist a second record and return success

#### Scenario RYT-08-D: Multiple null-userId rows do not collide at DB level

- GIVEN a `StudentGuardian` with `(studentId: "s1", userId: null)` already exists
- WHEN a second `StudentGuardian` with `(studentId: "s1", userId: null)` is inserted (different `fullName`)
- THEN the DB `@@unique([studentId, userId])` constraint MUST NOT fire (Postgres NULL != NULL)
- AND the insert succeeds

---

### Requirement: N Tutors per Student (REQ-RYT-09)

A single student MAY have any number of `StudentGuardian` records (both with and without `userId`). There is no enforced maximum at domain or DB level.

#### Scenario RYT-09-A: Student with multiple tutors

- GIVEN student `s1` has no existing tutors
- WHEN three `CreateStudyTutorUseCase` calls succeed for `s1` with distinct `fullName` values
- THEN `GET /v1/students/s1/guardians` returns all three records

---

### Requirement: Portal (get-my-children) Excludes Contact-Only Tutors (REQ-RYT-10)

`GET /v1/students/my-children` MUST return only students linked to the authenticated user via `StudentGuardian` records where `userId = authenticatedUserId`. Records with `userId = null` MUST be excluded from this query.

#### Scenario RYT-10-A: Tutor with portal sees their students

- GIVEN authenticated TUTOR with `userId = "u1"` linked to student `s1` via `StudentGuardian` (`userId = "u1"`)
- WHEN `GET /v1/students/my-children` is called
- THEN the response MUST include `s1`

#### Scenario RYT-10-B: Contact-only tutors do not contaminate my-children

- GIVEN student `s1` has only one `StudentGuardian` record with `userId = null` (study tutor)
- WHEN an authenticated TUTOR with `userId = "u1"` calls `GET /v1/students/my-children`
- THEN `s1` MUST NOT appear in the response (no portal link to `u1`)

---

### Requirement: Mobile Value Object (REQ-RYT-11)

A `Mobile` value object MUST exist in `packages/domain/src/shared/value-objects/` following the `Email` VO pattern. `Mobile` MUST validate that the value is a non-empty string matching a basic international phone number format. Normalization: strip spaces, dashes, parentheses, and dots; preserve a single optional leading `+`. After normalization, remaining characters must be digits only, count 8–15. `Mobile` MUST be immutable and self-validating, returning `Result<Mobile, ValidationError>`. Exported from `shared/value-objects/index.ts` and root `index.ts`.

#### Scenario RYT-11-A: Valid format accepted

- GIVEN a phone string `"+5492215551234"`
- WHEN `Mobile.create("+5492215551234")` is called
- THEN `Result.isOk()` is `true` and `mobile.get()` returns the normalized value

#### Scenario RYT-11-B: Invalid format rejected

- GIVEN a phone string `"abc"` (non-numeric, no country code)
- WHEN `Mobile.create("abc")` is called
- THEN `Result.isErr()` is `true` with a `MOBILE_INVALID` validation error

#### Scenario RYT-11-C: Empty value rejected

- GIVEN an empty string `""`
- WHEN `Mobile.create("")` is called
- THEN `Result.isErr()` is `true`

---

### Requirement: Guardian List Includes All Record Types (REQ-RYT-12)

`GET /v1/students/:id/guardians` MUST return ALL `StudentGuardian` records for the student — both with `userId` (portal tutors) and without (study tutors). The response shape MUST include: `{ id, userId, fullName, mobile, email, relationship, isFinancialResponsible, isAuthorizedToPickUp, active, updatedAt }`.

#### Scenario RYT-12-A: Mixed list — portal and study tutors

- GIVEN student `s1` has one guardian with `userId = "u-tutor"` and one study tutor with `userId = null`
- WHEN `GET /v1/students/s1/guardians` is called with ADMIN token
- THEN HTTP 200 is returned with both records
- AND each record includes all fields defined in REQ-RYT-12

#### Scenario RYT-12-B: Study tutors only

- GIVEN student `s1` has two study tutors (both with `userId = null`)
- WHEN `GET /v1/students/s1/guardians` is called
- THEN both records are returned

#### Scenario: Returns list (original)

- GIVEN a student with two guardian records and a valid token
- WHEN `GET /v1/students/s1/guardians` is called
- THEN HTTP 200 is returned with both records in the response body

#### Scenario: Empty list

- GIVEN a student with no guardian records
- WHEN `GET /v1/students/s1/guardians` is called
- THEN HTTP 200 is returned with an empty array `[]`

---

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

---

### Requirement: UI — Admin Manages Study Tutors from Student Panel (REQ-RYT-13)

The student admin panel MUST expose a section to list, create, and edit study tutors for that student. Listing MUST display: `fullName`, `mobile`, `email`, `relationship`, `active`. Create and edit MUST use the same form (dispatching to `CreateStudyTutorUseCase` vs `UpdateStudyTutorUseCase` respectively). Listing SHOULD distinguish portal-linked tutors from contact-only tutors visually (e.g., badge or icon). The `relationship` field is a free-text input (`maxLength=15`).

#### Scenario RYT-13-A: Admin lists tutors for a student

- GIVEN an ADMIN user viewing student `s1`'s panel
- WHEN the tutor section is rendered
- THEN all `StudentGuardian` records for `s1` are displayed with `fullName`, `mobile`, `active`

#### Scenario RYT-13-B: Admin creates study tutor

- GIVEN an ADMIN user in the tutor creation form for student `s1`
- WHEN the ADMIN fills `fullName`, `mobile`, `relationship` and submits
- THEN the form calls `POST /v1/students/s1/guardians` (no `userId`) and the new tutor appears in the list
- AND HTTP 201 is returned

#### Scenario RYT-13-C: Admin edits study tutor

- GIVEN an ADMIN user and a study tutor `sg1` for student `s1`
- WHEN the ADMIN opens the edit form, changes `mobile`, and submits
- THEN `PATCH /v1/students/s1/guardians/sg1` is called with `{ mobile: "..." }`
- AND the list reflects the updated value

#### Scenario RYT-13-D: Admin deactivates study tutor

- GIVEN an ADMIN user and a study tutor `sg1` with `active = true`
- WHEN the ADMIN toggles `active` off and saves
- THEN `PATCH /v1/students/s1/guardians/sg1` is called with `{ active: false }`
- AND the tutor is marked inactive in the UI

---

### Requirement: Email Pre-Fill from Legajo when Relationship is Father/Mother (REQ-RYT-14)

When creating or editing a study tutor and the user selects a `relationship` that is `"father"` (padre) or `"mother"` (madre), the UI MUST pre-fill the `email` field from `Student.fatherEmail` or `Student.motherEmail` respectively **when the `email` field is currently empty**. The pre-fill MUST NOT overwrite a value the user has already typed into the `email` field. This pre-fill is an EDITABLE default — the user MAY override it before saving. The tutor's `email` and the student's `fatherEmail`/`motherEmail` MAY diverge after separate edits.

#### Scenario RYT-14-A: Pre-fill email on selecting "father"

- GIVEN an ADMIN user in the tutor creation form for student `s1` where `s1.fatherEmail = "padre@example.com"`
- WHEN the ADMIN selects `relationship = "father"` and the email field is currently empty
- THEN the `email` field MUST be pre-filled with `"padre@example.com"`
- AND the field remains editable

#### Scenario RYT-14-B: No pre-fill when fatherEmail absent

- GIVEN student `s1` has no `fatherEmail`
- WHEN the ADMIN selects `relationship = "father"`
- THEN the `email` field MUST be left empty (no pre-fill); no error raised

#### Scenario RYT-14-C: Pre-fill is editable — divergence permitted

- GIVEN an ADMIN in the creation form with `s1.fatherEmail = "padre@example.com"` and `relationship = "father"` pre-filled
- WHEN the ADMIN changes `email` to `"otro@example.com"` before submitting
- THEN the system persists `email = "otro@example.com"` in `StudentGuardian`
- AND `Student.fatherEmail` remains `"padre@example.com"` (unchanged)

#### Scenario RYT-14-D: Pre-fill for "mother"

- GIVEN an ADMIN user in the tutor creation form for student `s1` where `s1.motherEmail = "madre@example.com"`
- WHEN the ADMIN selects `relationship = "mother"` and the email field is currently empty
- THEN the `email` field MUST be pre-filled with `"madre@example.com"`

---

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
